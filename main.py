# import os
# import nltk
# NLTK_DATA_PATH = os.path.join(os.path.dirname(__file__), "nltk_data")
# nltk.data.path.insert(0, NLTK_DATA_PATH)
# print("NLTK DATA PATHS:", nltk.data.path)
# print("Exists?", os.path.exists(os.path.join(NLTK_DATA_PATH, "tokenizers/punkt/english.pickle")))


from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


app = FastAPI()


# CORS(로컬 프론트와 연동할 때만)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def split_sentences(text):
    import re
    sents = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sents if s.strip()]

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    text = (await file.read()).decode("utf-8")
    sents = split_sentences(text)
    return {"sentences": sents}

# @app.post("/upload")
# async def upload(file: UploadFile = File(...)):
#     contents = await file.read()
#     text = contents.decode('utf-8')
#     # 문장 분리 (한글은 punkt로도 어느정도 됨. 문제 있으면 kss 추천)
#     sentences = nltk.sent_tokenize(text)
#     # <MATH> 포함 문장만 추출
#     math_sentences = [s for s in sentences if "<MATH>" in s]
#     return JSONResponse(content={"sentences": math_sentences})
