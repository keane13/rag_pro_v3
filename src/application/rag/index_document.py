from .vectorstore import get_weaviate_client, get_embeddings
from .loader import load_documents
from .splitter import split_docs
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_weaviate.vectorstores import WeaviateVectorStore
from src.infrastructure.config.configs import DOCS_PATH


def build_index():
    # 1️⃣ Load documents
    docs = load_documents(DOCS_PATH)

    if not docs:
        print("⚠️ No documents loaded")
        return

    # 2️⃣ Chunking (MANDATORY for RAG)
    #s
    chunks = split_docs(docs)

    print(f"📄 Documents: {len(docs)}")
    print(f"✂️ Chunks: {len(chunks)}")

    # 3️⃣ Index to Weaviate
    WeaviateVectorStore.from_documents(
        documents=chunks,
        embedding=get_embeddings(),
        client=get_weaviate_client(),
        index_name="DocumentChunk_final",
        batch_size=100,
        #index_params={"index_type": "FLAT"}  # OK for small data
    )

    print("✅ Indexing selesai")


if __name__ == "__main__":
    build_index()
