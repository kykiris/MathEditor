import React, { useState } from "react";

function tokenize(sentence) {
  const tagRegex = /(<MATH>|<\/MATH>)/g;
  const splitByTag = sentence.split(tagRegex).filter(Boolean);
  let tokens = [];
  splitByTag.forEach(part => {
    if (part === "<MATH>" || part === "</MATH>") {
      tokens.push(part);
    } else {
      const parts = part.match(/\S+|\s/g);
      if (parts) tokens.push(...parts);
    }
  });
  return tokens.filter(Boolean);
}

function joinTokens(tokens) {
  let joined = tokens.join("");

  // <MATH> 앞뒤 최소 한 칸, 중복 방지
  joined = joined.replace(/([^\s])<MATH>/g, '$1 <MATH>');
  joined = joined.replace(/<MATH>([^\s])/g, '<MATH> $1');
  joined = joined.replace(/([^\s])<\/MATH>/g, '$1 </MATH>');

  // </MATH> 뒤가 쉼표/마침표 등 기호라면 공백 제거, 아니면 한 칸 보장
  joined = joined.replace(/<\/MATH>\s*([,.;:!?])/g, '</MATH>$1');
  joined = joined.replace(/<\/MATH>([^\s,.;:!?])/g, '</MATH> $1');

  // 연속 공백은 하나로
  return joined.replace(/\s+/g, " ").trim();
}



function App() {
  const [file, setFile] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [editedSentences, setEditedSentences] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const [undoStack, setUndoStack] = useState([]); // Undo 히스토리


  

  function handleExport() {
    const content = editedSentences.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "export.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleUpload = async () => {
    if (!file) return alert("파일을 선택하세요!");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("https://mathtageditor.onrender.com/upload", { method: "POST", body: formData });
    const data = await res.json();
    setSentences(data.sentences || []);
    setEditedSentences(data.sentences || []);
    setCurrentIdx(0);
  };

  // 드래그 시작
  const handleDragStart = (idx) => {
    setDragIdx(idx);
    setDropIdx(null);
  };

  // "토큰 사이"에 마우스 올라갈 때
  const handleDragEnterSep = (i) => {
    if (dragIdx !== null) setDropIdx(i);
  };

  // "토큰 위"에 마우스 올라갈 때(앞쪽에 삽입)
  const handleDragEnterTok = (i) => {
    if (dragIdx !== null) setDropIdx(i);
  };

  // 드랍 시 토큰 이동
  const handleDrop = () => {
    if (dragIdx === null || dropIdx === null || dragIdx === dropIdx) {
      setDropIdx(null);
      setDragIdx(null);
      return;
    }
    const cur = editedSentences[currentIdx];
    const tokens = tokenize(cur);
    const [moving] = tokens.splice(dragIdx, 1);
    // dragIdx < dropIdx면 dropIdx - 1로!
    const realDropIdx = dragIdx < dropIdx ? dropIdx - 1 : dropIdx;
    tokens.splice(realDropIdx, 0, moving);

    setUndoStack(stack => [...stack, [...editedSentences]]);
    const newSentence = joinTokens(tokens);
    const arr = [...editedSentences];
    arr[currentIdx] = newSentence;
    setEditedSentences(arr);
    setDropIdx(null);
    setDragIdx(null);
  };

  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(stack => stack.slice(0, -1));
    setEditedSentences(prev);
  };

  const handleDragEnd = () => {
    setDropIdx(null);
    setDragIdx(null);
  };

  const goPrev = () => setCurrentIdx(idx => Math.max(0, idx - 1));
  const goNext = () => setCurrentIdx(idx => Math.min(sentences.length - 1, idx + 1));

  function renderDraggableTokens() {
    if (editedSentences.length === 0) return null;
    const cur = editedSentences[currentIdx];
    const tokens = tokenize(cur);

    let spans = [];
    for (let i = 0; i <= tokens.length; ++i) {
      // 토큰 사이 삽입선
      spans.push(
        <span
          key={`sep-${i}`}
          onDragEnter={e => { e.preventDefault(); handleDragEnterSep(i); }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            display: "inline-block",
            width: dropIdx === i ? 4 : 0,
            height: 34,
            background: dropIdx === i ? "red" : "transparent",
            verticalAlign: "middle",
            margin: "0 2px",
            borderRadius: 4,
            transition: "background 0.08s"
          }}
        ></span>
      );
      if (i < tokens.length) {
        const token = tokens[i];
        const isMathTag = token === "<MATH>" || token === "</MATH>";
        const isWideSpace = token === " ";
        spans.push(
          <span
            key={`tok-${i}`}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragEnd={handleDragEnd}
            onDragEnter={e => { e.preventDefault(); handleDragEnterTok(i); }}  // ★ 추가: 토큰 위 드롭 지원
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              userSelect: "none",
              padding: isMathTag
                ? "6px 8px"
                : isWideSpace
                ? "6px 8px"
                : "6px 3px",
              margin: 0,
              background:
                dragIdx === i
                  ? "#ffd"
                  : isMathTag
                  ? token === "<MATH>" ? "#c3f4db" : "#d0e9f8"
                  : isWideSpace
                  ? "#eee"
                  : "#f9f9f9",
              border:
                isMathTag
                  ? "2px solid #999"
                  : isWideSpace
                  ? "1px dashed #ccc"
                  : "1px solid #eee",
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: 20,
              cursor: "grab",
              opacity: dragIdx === i ? 0.6 : 1,
              fontWeight: isMathTag ? "bold" : "normal",
              color:
                isMathTag
                  ? token === "<MATH>"
                    ? "#007b51"
                    : "#045179"
                  : "#333",
              whiteSpace: "pre"
            }}
            title={isWideSpace ? "띄어쓰기" : token}
          >
            {isWideSpace ? "\u2003" : token}
          </span>
        );
      }
    }

    return (
      <div
        style={{
          display: "flex",
          gap: 0,
          minHeight: 40,
          flexWrap: "wrap",
          background: "#f4f8ff",
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: 10,
          marginBottom: 20
        }}
      >
        {spans}
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 700, margin: "auto" }}>
      <h2>MathTagEditor</h2>
      <input type="file" onChange={handleFileChange} accept=".txt" />
      <button onClick={handleUpload}>Upload</button>
      <hr />
      {sentences.length > 0 && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button onClick={goPrev} disabled={currentIdx === 0}>Prev</button>
            <span style={{ margin: '0 12px' }}>
              {currentIdx + 1} / {sentences.length}
            </span>
            <button onClick={goNext} disabled={currentIdx === sentences.length - 1}>Next</button>
            <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ marginLeft: 16 }}>
              Undo (Undo)
            </button>
            <button onClick={handleExport} style={{ marginLeft: 16 }}>
              Export... (Export)
            </button>
          </div>
          <div style={{
            border: "1px solid #ccc", borderRadius: 8, padding: 24, fontSize: 18,
            minHeight: 80, background: "#fafafa", marginBottom: 16
          }}>
            <b>Result:</b><br />
            {editedSentences[currentIdx]}
          </div>
          <b>{"DRAG & DROP to move the tags"}</b>
          {renderDraggableTokens()}
        </div>
      )}
    </div>
  );
}

export default App;
