from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community import vectorstores
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings


with open(r"C:\Users\sound\Desktop\heritage chatbot 2\data\heritage_sites.txt.txt", "r", encoding="utf-8") as file:
    text = file.read()


text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
docs = text_splitter.create_documents([text])

print(f"Total chunks created: {len(docs)}")
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vector_db = FAISS.from_documents(docs, embeddings)

vector_db.save_local("faiss_index")

print("FAISS index created successfully!")