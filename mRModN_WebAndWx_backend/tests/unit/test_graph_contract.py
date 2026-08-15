from graph_contract import build_graph_contract


def test_graph_contract_deduplicates_and_types_edges():
    graph = build_graph_contract(
        "ACGU",
        "(..)",
        [(0, 1), (1, 0), (1, 2), (0, 3), (3, 0)],
        modeled_sequence_length=4,
    )
    assert len(graph["nodes"]) == 4
    assert graph["structure"] == "(..)"
    assert [(e["sourceIndex"], e["targetIndex"], e["type"]) for e in graph["edges"]] == [
        (0, 1, "backbone"),
        (1, 2, "backbone"),
        (0, 3, "base_pair"),
    ]
    assert len(graph["layout"]["coordinates"]) == 4


def test_graph_contract_maps_padded_model_coordinates():
    graph = build_graph_contract(
        "AC",
        "....",
        [(1, 2), (0, 1), (2, 3)],
        modeled_sequence_length=4,
        left_padding=1,
    )
    assert [(e["sourceIndex"], e["targetIndex"]) for e in graph["edges"]] == [(0, 1)]
