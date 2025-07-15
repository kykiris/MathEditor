import React, { useState, useRef, useEffect } from "react";

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
  joined = joined.replace(/([^\s])<MATH>/g, '$1 <MATH>');
  joined = joined.replace(/<MATH>([^\s])/g, '<MATH> $1');
  joined = joined.replace(/([^\s])<\/MATH>/g, '$1 </MATH>');
  joined = joined.replace(/<\/MATH>\s*([,.;:!?])/g, '</MATH>$1');
  joined = joined.replace(/<\/MATH>([^\s,.;:!?])/g, '</MATH> $1');
  return joined.replace(/\s+/g, " ").trim();
}

function calcTagMoveAccuracy(originalSentences, editedSentences) {
  let totalTags = 0;
  let movedTags = 0;

  function tagPositions(tokens, tag) {
    // 태그별 위치 인덱스 배열 리턴
    const positions = [];
    tokens.forEach((t, i) => {
      if (t === tag) positions.push(i);
    });
    return positions;
  }

  for (let i = 0; i < originalSentences.length; ++i) {
    const orig = originalSentences[i] || "";
    const edit = editedSentences[i] || "";

    // 기존 tokenize 함수 사용 (단어+공백+태그 단위 분리)
    const origTokens = tokenize(orig);
    const editTokens = tokenize(edit);

    // 각 문장에서 <MATH>와 </MATH> 위치 찾기
    const origMathPos = tagPositions(origTokens, "<MATH>");
    const editMathPos = tagPositions(editTokens, "<MATH>");
    const origEndPos = tagPositions(origTokens, "</MATH>");
    const editEndPos = tagPositions(editTokens, "</MATH>");

    // 전체 태그 개수 세기
    totalTags += origMathPos.length;
    totalTags += origEndPos.length;

    // 이동(변경)된 태그 개수 세기
    for (let j = 0; j < origMathPos.length; ++j) {
      if (editMathPos[j] !== origMathPos[j]) movedTags += 1;
    }
    for (let j = 0; j < origEndPos.length; ++j) {
      if (editEndPos[j] !== origEndPos[j]) movedTags += 1;
    }
  }

  // Accuracy 계산 (변경되지 않은 태그 개수 / 전체 태그 개수)
  const unchanged = totalTags - movedTags;
  const accuracy = totalTags === 0 ? 1 : unchanged / totalTags;
  return { totalTags, movedTags, accuracy };
}

function App() {
  const [fileList, setFileList] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [editedSentences, setEditedSentences] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  

  const tokenDivRef = useRef();

  // const modifiedCount = sentences.reduce(
  //   (count, s, i) => count + (editedSentences[i] !== s ? 1 : 0),
  //   0
  // );
  // const totalCount = sentences.length;
  const { totalTags, movedTags, accuracy } = calcTagMoveAccuracy(sentences, editedSentences);
  const accuracyStr = (accuracy * 100).toFixed(2) + "%";


  // 포커스를 항상 유지 (문장 바뀔 때, 마운트 후)
  useEffect(() => {
    if (editedSentences.length === 0) return;
    const tokens = tokenize(editedSentences[currentIdx]);
    setSelectedIdx(idx => Math.min(idx, tokens.length - 1));
    if (tokenDivRef.current) tokenDivRef.current.focus();
  }, [currentIdx, sentences.length, editedSentences]);

  function handleExport() {
    // 수정 버전에서 math 태그(<MATH> 또는 </MATH>)가 하나라도 남아있는 문장만 export
    const mathTagRegex = /<MATH>|<\/MATH>/;
    const filtered = editedSentences.filter(s => mathTagRegex.test(s));
    if (filtered.length === 0) {
      alert("수식 태그가 남아있는 문장이 없습니다.");
      return;
    }
    const content = filtered.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }


  const handleFileChange = (e) => setFileList(e.target.files);
  const handleUpload = async () => {
    if (!fileList || fileList.length === 0) return alert("파일을 선택하세요!");
    const formData = new FormData();
    for (let i = 0; i < fileList.length; ++i) {
      formData.append("files", fileList[i]); // name은 FastAPI 파라미터명과 맞춰야 함!
    }
    const res = await fetch("https://mathtageditor.onrender.com/upload", {
      method: "POST", body: formData
    });
    const data = await res.json();
    setSentences(data.sentences || []);
    setEditedSentences(data.sentences || []);
    setCurrentIdx(0);
  };

  // Undo (키보드/버튼)
  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(stack => stack.slice(0, -1));
    setEditedSentences(prev);
  };

  function handleKeyDown(e) {
    if (editedSentences.length === 0) return;
    const tokens = tokenize(editedSentences[currentIdx]);
    const maxIdx = tokens.length - 1;

    // Undo
    if (e.ctrlKey && e.key === "z") {
      handleUndo();
      e.preventDefault();
      return;
    }

    // 이동 모드 아님 (토큰 선택)
    if (dragIdx === null) {
      if (e.key === "ArrowRight") {
        setSelectedIdx(idx => Math.min(maxIdx, idx + 1));
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        setSelectedIdx(idx => Math.max(0, idx - 1));
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        // 아래 줄 같은 인덱스(불가하면 마지막)
        if (currentIdx < sentences.length - 1) {
          const nextTokens = tokenize(editedSentences[currentIdx + 1]);
          setCurrentIdx(currentIdx + 1);
          setSelectedIdx(idx => Math.min(idx, nextTokens.length - 1));
        }
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        // 위 줄 같은 인덱스(불가하면 마지막)
        if (currentIdx > 0) {
          const prevTokens = tokenize(editedSentences[currentIdx - 1]);
          setCurrentIdx(currentIdx - 1);
          setSelectedIdx(idx => Math.min(idx, prevTokens.length - 1));
        }
        e.preventDefault();
      } else if (e.key === "Enter" || e.key === " ") {
        setDragIdx(selectedIdx);
        setDropIdx(selectedIdx);
        e.preventDefault();
      }
    } else {
      // 이동모드
      if (e.key === "ArrowRight") {
        setDropIdx(idx => Math.min(tokens.length, idx + 1));
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        setDropIdx(idx => Math.max(0, idx - 1));
        e.preventDefault();
      } else if (e.key === "Enter" || e.key === " ") {
        if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
          const tokensArr = [...tokens];
          const [moving] = tokensArr.splice(dragIdx, 1);
          const realDrop = dragIdx < dropIdx ? dropIdx - 1 : dropIdx;
          tokensArr.splice(realDrop, 0, moving);

          setUndoStack(stack => [...stack, [...editedSentences]]);
          const arr = [...editedSentences];
          arr[currentIdx] = joinTokens(tokensArr);
          setEditedSentences(arr);
          setSelectedIdx(realDrop);
        }
        setDragIdx(null);
        setDropIdx(null);
        e.preventDefault();
      } else if (e.key === "Escape") {
        setDragIdx(null);
        setDropIdx(null);
        e.preventDefault();
      }
    }

    if (dragIdx === null) {
      if ((e.key === "Delete" || e.key === "Backspace") && isMathTag(tokens[selectedIdx])) {
        setUndoStack(stack => [...stack, [...editedSentences]]);
        const tokensArr = [...tokens];
        tokensArr.splice(selectedIdx, 1);
        const arr = [...editedSentences];
        arr[currentIdx] = joinTokens(tokensArr);
        setEditedSentences(arr);
        setSelectedIdx(Math.max(0, selectedIdx - 1));
        e.preventDefault();
      }
    }
    function isMathTag(token) {
      return token === "<MATH>" || token === "</MATH>";
    }

  }

  const goPrev = () => {
    setCurrentIdx(idx => Math.max(0, idx - 1));
    setSelectedIdx(0);
    setDragIdx(null);
    setDropIdx(null);
  };
  const goNext = () => {
    setCurrentIdx(idx => Math.min(sentences.length - 1, idx + 1));
    setSelectedIdx(0);
    setDragIdx(null);
    setDropIdx(null);
  };

  // 드래그&드롭 그대로 유지 (마우스)
  const handleDragStart = (idx) => {
    setDragIdx(idx);
    setDropIdx(null);
  };
  const handleDragEnterSep = (i) => {
    if (dragIdx !== null) setDropIdx(i);
  };
  const handleDragEnterTok = (i) => {
    if (dragIdx !== null) setDropIdx(i);
  };
  const handleDrop = () => {
    if (dragIdx === null || dropIdx === null || dragIdx === dropIdx) {
      setDropIdx(null);
      setDragIdx(null);
      return;
    }
    const cur = editedSentences[currentIdx];
    const tokens = tokenize(cur);
    const [moving] = tokens.splice(dragIdx, 1);
    const realDropIdx = dragIdx < dropIdx ? dropIdx - 1 : dropIdx;
    tokens.splice(realDropIdx, 0, moving);

    setUndoStack(stack => [...stack, [...editedSentences]]);
    const newSentence = joinTokens(tokens);
    const arr = [...editedSentences];
    arr[currentIdx] = newSentence;
    setEditedSentences(arr);
    setDropIdx(null);
    setDragIdx(null);
    setSelectedIdx(realDropIdx); // 이동 후 키보드 포커스 연동
  };
  const handleDragEnd = () => {
    setDropIdx(null);
    setDragIdx(null);
  };

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
            onDragEnter={e => { e.preventDefault(); handleDragEnterTok(i); }}
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
                selectedIdx === i
                  ? "#f9f"
                  : dragIdx === i
                  ? "#ffd"
                  : isMathTag
                  ? token === "<MATH>" ? "#c3f4db" : "#d0e9f8"
                  : isWideSpace
                  ? "#eee"
                  : "#f9f9f9",
              border:
                selectedIdx === i
                  ? "2px solid #b0b"
                  : dragIdx === i
                  ? "2px dashed #999"
                  : isMathTag
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
        ref={tokenDivRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          display: "flex",
          outline: "none",
          gap: 0,
          minHeight: 40,
          flexWrap: "wrap",
          background: "#f4f8ff",
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: 10,
          marginBottom: 20,
        }}
      >
        {spans}
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 700, margin: "auto" }}>
      <h2>MathTagEditor</h2>
      <p style={{ color: "#555", fontSize: 16, margin: "8px 0 16px 0" }}>
        안 돌아가면 김유경에게 알려주세요...
      </p>
      <p style={{ color: "#555", fontSize: 16, margin: "8px 0 16px 0" }}>
        무료 호스팅 중이라 중간중간 로딩이 오래 걸릴 수도 있습니다. Upload 버튼 누르고 아무 일도 일어나지 않으면 몇 분 정도 더 기다려보세요
      </p>
      <input type="file" onChange={handleFileChange} accept=".txt" multiple />
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
              Undo
            </button>
            <button onClick={handleExport} style={{ marginLeft: 16 }}>
              Export...
            </button>
            <div style={{ fontSize: 14, color: "#888", marginTop: 5, marginLeft: 30 }}>
              위치가 바뀐 태그: {movedTags} / 전체 태그 {totalTags}
              <span style={{ marginLeft: 16 }}>
                Accuracy: {accuracyStr}
              </span>
            </div>
          </div>
          <div style={{
            border: "1px solid #ccc", borderRadius: 8, padding: 24, fontSize: 18,
            minHeight: 80, background: "#fafafa", marginBottom: 16
          }}>
            <b>Result:</b><br />
            {editedSentences[currentIdx]}
          </div>
          {renderDraggableTokens()}
          <b>{"1.1. DRAG & DROP을 통해 마우스로 직접 토큰을 옮길 수 있습니다."}<br></br></b>
          <b>{"1.2. 키보드로 토큰을 옮기는 방법은 다음과 같습니다. 왼쪽, 오른쪽 방향키를 이용하여 포커스를 이동한 후 스페이스바를 누르면 토큰이 선택됩니다. 토큰이 선택된 상태에서 왼/오 방향키를 누르면 토큰을 문장 내에서 이동시킬 수 있습니다."}<br></br></b>
          <b>{"2. 위/아래 방향키로 문장 간 이동이 가능합니다."}<br></br></b>
          <b>{"3. Ctrl+Z로 Undo 할 수 있습니다."}<br></br></b>
          <b>{"4. ESC를 이용해 포커스 선택을 취소할 수 있습니다.(또는 스페이스바 한 번 더)"}</b>
        </div>
      )}
    </div>
  );
}

export default App;
