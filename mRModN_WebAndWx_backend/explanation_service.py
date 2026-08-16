"""Shared Integrated Gradients and GCN message-passing computations.

The Flask process and Celery worker both use these pure helpers so synchronous
Web endpoints and asynchronous mini-program endpoints keep the same contract.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

import numpy as np
import torch
from captum.attr import IntegratedGradients
from torch_geometric.data import Batch

from human import build_edge_index_from_structure, run_linearfold

NUCLEOTIDE_NAMES = {
    "A": "腺嘌呤", "C": "胞嘧啶", "G": "鸟嘌呤", "U": "尿嘧啶", "T": "胸腺嘧啶", "N": "未知碱基",
}


def normalize_rna_sequence(value: str) -> str:
    sequence = "".join(str(value or "").upper().split()).replace("T", "U")
    invalid = sorted(set(sequence) - set("ACGUN"))
    if invalid:
        raise ValueError(f"RNA sequence contains invalid bases: {''.join(invalid)}")
    if not sequence:
        raise ValueError("No sequence provided")
    return sequence


def explanation_cache_key(kind: str, sequence: str, parameter: int, checkpoint: str) -> str:
    payload = json.dumps(
        {"kind": kind, "sequence": sequence, "parameter": int(parameter), "checkpoint": checkpoint},
        sort_keys=True,
        separators=(",", ":"),
    )
    return f"wx:explanation:cache:{hashlib.sha256(payload.encode('utf-8')).hexdigest()}"


def _one_hot(sequence: str) -> np.ndarray:
    mapping = {
        "A": [1.0, 0.0, 0.0, 0.0], "C": [0.0, 1.0, 0.0, 0.0],
        "G": [0.0, 0.0, 1.0, 0.0], "U": [0.0, 0.0, 0.0, 1.0],
        "N": [0.0, 0.0, 0.0, 0.0],
    }
    return np.asarray([mapping[base] for base in sequence], dtype=np.float32)


def _prepare_sequence(original_sequence: str, target_length: int) -> tuple[str, int, int]:
    sequence = normalize_rna_sequence(original_sequence)
    left_padding = 0
    left_trimming = 0
    if len(sequence) < target_length:
        padding = target_length - len(sequence)
        left_padding = padding // 2
        sequence = "N" * left_padding + sequence + "N" * (padding - left_padding)
    elif len(sequence) > target_length:
        excess = len(sequence) - target_length
        left_trimming = excess // 2
        sequence = sequence[left_trimming:len(sequence) - (excess - left_trimming)]
    return sequence, left_padding, left_trimming


def _model_inputs(sequence: str, device: str) -> tuple[Batch, torch.Tensor]:
    structure = run_linearfold([sequence])[0]
    edge_index = build_edge_index_from_structure(sequence, structure)
    x = torch.tensor(_one_hot(sequence), dtype=torch.float32)
    batch = torch.zeros(len(sequence), dtype=torch.long)
    data_batch = Batch(x=x, edge_index=edge_index, batch=batch).to(device)
    return data_batch, edge_index


def _original_edges(
    edge_index: torch.Tensor,
    original_sequence: str,
    left_padding: int,
    left_trimming: int,
) -> list[dict[str, str]]:
    edges: list[dict[str, str]] = []
    seen: set[tuple[int, int]] = set()
    for source, target in edge_index.detach().cpu().t().tolist():
        orig_source = int(source) - left_padding + left_trimming
        orig_target = int(target) - left_padding + left_trimming
        if not (0 <= orig_source < len(original_sequence) and 0 <= orig_target < len(original_sequence)):
            continue
        pair = tuple(sorted((orig_source, orig_target)))
        if pair[0] == pair[1] or pair in seen:
            continue
        seen.add(pair)
        source_index, target_index = pair
        edges.append({
            "source": f"{original_sequence[source_index]}{source_index}",
            "target": f"{original_sequence[target_index]}{target_index}",
        })
    return edges


def _nodes(original_sequence: str, scores: list[float] | None = None) -> list[dict[str, Any]]:
    nodes = []
    for index, base in enumerate(original_sequence):
        data: dict[str, Any] = {"index": index, "type": base, "name": NUCLEOTIDE_NAMES.get(base, "未知碱基")}
        if scores is not None:
            data["attributionScore"] = float(scores[index])
        nodes.append({"id": f"{base}{index}", "label": f"位置{index + 1}: {base}", "data": data})
    return nodes


def compute_integrated_gradients(
    model: torch.nn.Module,
    model_cfg: dict[str, Any],
    device: str,
    original_sequence: str,
    target_class_id: int,
    target_length: int = 1001,
    n_steps: int = 32,
) -> dict[str, Any]:
    original_sequence = normalize_rna_sequence(original_sequence)
    if not 0 <= int(target_class_id) < 12:
        raise ValueError("Invalid targetClassId. Must be between 0 and 11")
    sequence, left_padding, left_trimming = _prepare_sequence(original_sequence, target_length)
    data_batch, edge_index = _model_inputs(sequence, device)

    def forward_func(x: torch.Tensor, graph_edges: torch.Tensor, graph_batch: torch.Tensor) -> torch.Tensor:
        output = model(x, graph_edges, graph_batch)
        if model_cfg.get("use_hierarchical"):
            return output[0]
        if isinstance(output, tuple):
            return output[0]
        return output

    integrated_gradients = IntegratedGradients(forward_func)
    with torch.enable_grad():
        inputs = data_batch.x.unsqueeze(0)
        baseline = torch.zeros_like(inputs)
        attributions = integrated_gradients.attribute(
            inputs,
            baselines=baseline,
            target=int(target_class_id),
            additional_forward_args=(data_batch.edge_index, data_batch.batch),
            internal_batch_size=1,
            n_steps=max(8, int(n_steps)),
        )
    model_scores = attributions.squeeze(0).sum(dim=1).detach().cpu().tolist()
    original_scores = []
    for index in range(len(original_sequence)):
        model_index = index + left_padding - left_trimming
        original_scores.append(float(model_scores[model_index]) if 0 <= model_index < len(model_scores) else 0.0)
    return {
        "sequence": original_sequence,
        "positionBase": 0,
        "nodes": _nodes(original_sequence, original_scores),
        "edges": _original_edges(edge_index, original_sequence, left_padding, left_trimming),
        "targetClassId": int(target_class_id),
        "nSteps": max(8, int(n_steps)),
    }


def compute_gcn_message_passing(
    model: torch.nn.Module,
    device: str,
    original_sequence: str,
    target_node_idx: int,
    target_length: int = 1001,
) -> dict[str, Any]:
    original_sequence = normalize_rna_sequence(original_sequence)
    target_node_idx = int(target_node_idx)
    if not 0 <= target_node_idx < len(original_sequence):
        raise ValueError(f"targetNodeIdx must be between 0 and {len(original_sequence) - 1}")
    sequence, left_padding, left_trimming = _prepare_sequence(original_sequence, target_length)
    model_target_idx = target_node_idx + left_padding - left_trimming
    if not 0 <= model_target_idx < len(sequence):
        raise ValueError("Target node is outside the modeled 1001-nt window")
    data_batch, edge_index = _model_inputs(sequence, device)
    with torch.no_grad():
        _, aggregation_details = model(
            data_batch.x,
            data_batch.edge_index,
            data_batch.batch,
            return_aggregation_details=True,
            target_node_idx=model_target_idx,
        )
    processed_layers = []
    for fallback_layer, layer_data in enumerate(aggregation_details or []):
        raw_messages = []
        for message in layer_data.get("messages", []):
            original_index = int(message["from"]) - left_padding + left_trimming
            if 0 <= original_index < len(original_sequence):
                raw_messages.append({"from": original_index, "to": target_node_idx, "strength": float(message["strength"])})
        max_strength = max((abs(message["strength"]) for message in raw_messages), default=0.0)
        for message in raw_messages:
            message["normalizedStrength"] = abs(message["strength"]) / max_strength if max_strength else 0.0
        processed_layers.append({"layer": int(layer_data.get("layer", fallback_layer)), "messages": raw_messages})
    return {
        "sequence": original_sequence,
        "positionBase": 0,
        "targetNode": target_node_idx,
        "nodes": _nodes(original_sequence),
        "edges": _original_edges(edge_index, original_sequence, left_padding, left_trimming),
        "aggregationData": processed_layers,
    }
