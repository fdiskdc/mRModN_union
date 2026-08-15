"""Keep critical Web and WeChat endpoint names/suffixes aligned."""
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
WEB_CONFIG = REPO_ROOT / "mRModN_WebAndWx_WebFrontend" / "config" / "api.config.ts"
WX_CONFIG = REPO_ROOT / "mRModN_WebAndWx_WxFrontend" / "utils" / "config" / "api.js"
WEB_VITE_CONFIG = REPO_ROOT / "mRModN_WebAndWx_WebFrontend" / "vite.config.ts"
WEB_INDEX = REPO_ROOT / "mRModN_WebAndWx_WebFrontend" / "index.html"
WX_APP_CONFIG = REPO_ROOT / "mRModN_WebAndWx_WxFrontend" / "app.json"
REID_API = REPO_ROOT / "mRModN_WebAndWx_backend" / "mrmodn_backend" / "api" / "reid.py"

ENDPOINT_SUFFIXES = {
    "SAMPLE_SEQUENCE": "/sample-sequence",
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



def test_public_addresses_use_rgcnformer_and_visible_brand_uses_mrmodn():
    address_sources = [
        WEB_CONFIG.read_text(encoding="utf-8"),
        WEB_VITE_CONFIG.read_text(encoding="utf-8"),
        WX_CONFIG.read_text(encoding="utf-8"),
        REID_API.read_text(encoding="utf-8"),
    ]
    assert all("/mrmodn" not in source for source in address_sources)
    assert all("/rgcnformer" in source for source in address_sources)
    assert "mRModN" in WEB_INDEX.read_text(encoding="utf-8")
    assert "mRModN" in WX_APP_CONFIG.read_text(encoding="utf-8")
