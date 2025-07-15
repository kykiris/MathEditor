# import os
# import nltk
# NLTK_DATA_PATH = os.path.join(os.path.dirname(__file__), "nltk_data")
# nltk.data.path.insert(0, NLTK_DATA_PATH)
# print("NLTK DATA PATHS:", nltk.data.path)
# print("Exists?", os.path.exists(os.path.join(NLTK_DATA_PATH, "tokenizers/punkt/english.pickle")))


from typing import List
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
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
    def contains_math_tag(s):
        s_lower = s.lower()
        return "<math>" in s_lower or "</math>" in s_lower
    return [s.strip() for s in sents if s.strip() and contains_math_tag(s)]

@app.post("/upload")
async def upload(files: List[UploadFile] = File(...)):
    all_sentences = []
    for file in files:
        text = (await file.read()).decode("utf-8")
        sents = split_sentences(text)
        all_sentences.extend(sents)
    return {"sentences": all_sentences}


# @app.post("/upload")
# async def upload(file: UploadFile = File(...)):
#     contents = await file.read()
#     text = contents.decode('utf-8')
#     # 문장 분리 (한글은 punkt로도 어느정도 됨. 문제 있으면 kss 추천)
#     sentences = nltk.sent_tokenize(text)
#     # <MATH> 포함 문장만 추출
#     math_sentences = [s for s in sentences if "<MATH>" in s]
#     return JSONResponse(content={"sentences": math_sentences})
