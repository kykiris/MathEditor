import nltk
nltk.download("punkt")
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

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    contents = await file.read()
    text = contents.decode('utf-8')
    # 문장 분리 (한글은 punkt로도 어느정도 됨. 문제 있으면 kss 추천)
    sentences = nltk.sent_tokenize(text)
    # <MATH> 포함 문장만 추출
    math_sentences = [s for s in sentences if "<MATH>" in s]
    return JSONResponse(content={"sentences": math_sentences})
