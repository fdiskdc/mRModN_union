"""Keep critical Web and WeChat endpoint names/suffixes aligned."""
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
WEB_CONFIG = REPO_ROOT / "mRModN_WebAndWx_WebFrontend" / "config" / "api.config.ts"
WX_CONFIG = REPO_ROOT / "mRModN_WebAndWx_WxFrontend" / "utils" / "config" / "api.js"

ENDPOINT_SUFFIXES = {
    "WX_LOGIN": "/wx/login",
    "WX_SUBMIT_TASK": "/wx-submit-task",
    "WX_TASK_PROGRESS": "/wx-task-progress/",
    "SUBMIT_TASK": "/submit-task",
    "RESULT": "/results/",
    "ATTENTION_DISTRIBUTION": "/attention-distribution",
    "ATTENTION_VISUALIZATION": "/attention-visualization",
    "INTEGRATED_GRADIENTS": "/integrated-gradients",
    "GCN_AGGREGATION": "/visualize-gcn-aggregation",
    "MODEL_GRAPH": "/model-graph",
}


def test_frontends_expose_matching_critical_endpoint_names_and_suffixes():
    web_source = WEB_CONFIG.read_text(encoding="utf-8")
    wx_source = WX_CONFIG.read_text(encoding="utf-8")

    for name, suffix in ENDPOINT_SUFFIXES.items():
        assert f"{name}:" in web_source, f"Web endpoint missing: {name}"
        assert f"{name}:" in wx_source, f"WeChat endpoint missing: {name}"
        assert suffix in web_source, f"Web suffix missing: {suffix}"
        assert suffix in wx_source, f"WeChat suffix missing: {suffix}"
