import importlib


def test_core_imports_available():
    for mod in ["langgraph.graph", "langgraph.prebuilt", "langchain_tavily",
                "langchain_openai", "dotenv"]:
        assert importlib.import_module(mod) is not None
