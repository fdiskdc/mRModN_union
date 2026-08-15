"""Shared RNA graph response helpers.

The model works in padded/truncated coordinates.  This module converts those
coordinates into the original sequence coordinate system and emits the graph
contract consumed by both the Web and WeChat clients.
"""
from __future__ import annotations

from typing import Iterable, Mapping, Sequence


NUCLEOTIDE_NAMES = {
    "A": "腺嘌呤",
    "C": "胞嘧啶",
    "G": "鸟嘌呤",
    "U": "尿嘧啶",
    "T": "胸腺嘧啶",
    "N": "未知碱基",
}


def build_circular_layout(length: int) -> dict:
    """Return normalized circular coordinates suitable for any renderer."""
    import math

    if length <= 0:
        return {"type": "circular", "coordinates": []}
    coordinates = []
    for index in range(length):
        angle = -math.pi / 2 + (2 * math.pi * index / length)
        coordinates.append({
            "index": index,
            "x": round(0.5 + 0.42 * math.cos(angle), 6),
            "y": round(0.5 + 0.42 * math.sin(angle), 6),
        })
    return {"type": "circular", "coordinates": coordinates}


def build_graph_contract(
    original_sequence: str,
    structure: str,
    edge_pairs: Iterable[Sequence[int]],
    *,
    modeled_sequence_length: int,
    left_padding: int = 0,
    left_trimming: int = 0,
    include_layout: bool = True,
) -> dict:
    """Build nodes/edges with stable indices and explicit edge semantics."""
    sequence = original_sequence.upper()
    nodes = []
    for index, base in enumerate(sequence):
        nodes.append({
            "id": f"{base}{index}",
            "index": index,
            "base": base,
            "label": f"位置 {index + 1}: {base}",
            # Keep the historical nested shape for old Web clients.
            "data": {
                "index": index,
                "type": base,
                "name": NUCLEOTIDE_NAMES.get(base, NUCLEOTIDE_NAMES["N"]),
            },
        })

    seen = set()
    edges = []
    for pair in edge_pairs:
        if len(pair) != 2:
            continue
        source, target = int(pair[0]), int(pair[1])
        if not (0 <= source < modeled_sequence_length and 0 <= target < modeled_sequence_length):
            continue

        source_index = source - left_padding + left_trimming
        target_index = target - left_padding + left_trimming
        if not (0 <= source_index < len(sequence) and 0 <= target_index < len(sequence)):
            continue
        if source_index == target_index:
            continue

        low, high = sorted((source_index, target_index))
        key = (low, high)
        if key in seen:
            continue
        seen.add(key)

        source_base = sequence[low]
        target_base = sequence[high]
        edge_type = "backbone" if high - low == 1 else "base_pair"
        edges.append({
            "source": f"{source_base}{low}",
            "target": f"{target_base}{high}",
            "sourceIndex": low,
            "targetIndex": high,
            "type": edge_type,
        })

    graph = {
        "sequence": sequence,
        "structure": structure or "",
        "nodes": nodes,
        "edges": edges,
        "layout": build_circular_layout(len(sequence)) if include_layout else None,
    }
    return graph
