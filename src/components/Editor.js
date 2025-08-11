import React, { useEffect, useRef, useState } from "react";
import Codemirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import ACTIONS from "../Actions";
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

const Editor = ({ socketRef, roomId, onCodeChange }) => {
  const editorRef = useRef(null);
  const [suggestion, setSuggestion] = useState("");

  // NEW: output state
  const [output, setOutput] = useState([]);

  useEffect(() => {
    editorRef.current = Codemirror.fromTextArea(
      document.getElementById("realtimeEditor"),
      {
        mode: { name: "javascript", json: true },
        theme: "dracula",
        autoCloseTags: true,
        autoCloseBrackets: true,
        lineNumbers: true,
      }
    );

    // Real-time code sharing
    editorRef.current.on("change", (instance, changes) => {
      const { origin } = changes;
      const code = instance.getValue();
      onCodeChange(code);
      if (origin !== "setValue") {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code,
        });
      }
    });
  }, []);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null) {
          editorRef.current.setValue(code);
        }
      });
    }
    return () => {
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    };
  }, [socketRef.current]);

  // Gemini API call
  const getGeminiSuggestions = async () => {
    const code = editorRef.current.getValue();
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=" +
          GEMINI_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze the following JavaScript code.
Provide suggestions for improvements, optimizations, or corrections.
Do not use any markdown bold (**).
Capitalize all section headings and ensure proper spacing between paragraphs and bullet points.
Code:
\`\`\`javascript
${code}
\`\`\``,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "No suggestion";
      setSuggestion(text);
    } catch (err) {
      console.error(err);
      setSuggestion("Error fetching suggestions.");
    }
  };

  // NEW: JS Runner
  const runCode = () => {
    const code = editorRef.current.getValue();
    let logs = [];
    const originalLog = console.log;

    console.log = (...args) => {
      logs.push(args.join(" "));
      originalLog(...args);
    };

    try {
      const result = eval(code);
      if (result !== undefined) logs.push(result);
    } catch (err) {
      logs.push("Error: " + err.message);
    }

    console.log = originalLog;
    setOutput(logs);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        height: "100vh",
        background: "#121212",
        color: "#fff",
        padding: "10px",
      }}
    >
      {/* Editor Section */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <textarea id="realtimeEditor"></textarea>
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <button
            onClick={getGeminiSuggestions}
            style={{
              padding: "8px",
              background: "#4CAF50",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Get AI Suggestions
          </button>
          {/* NEW: Run Code Button */}
          <button
            onClick={runCode}
            style={{
              padding: "8px",
              background: "#2196F3",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Run Code
          </button>
        </div>

        {/* NEW: Output panel */}
        <div
          style={{
            marginTop: "10px",
            background: "#1e1e1e",
            padding: "10px",
            borderRadius: "5px",
            minHeight: "150px",
            fontFamily: "monospace",
          }}
        >
          <h4>Output:</h4>
          {output.length === 0 ? (
            <p style={{ color: "gray" }}>No output yet...</p>
          ) : (
            output.map((line, idx) => <div key={idx}>{line}</div>)
          )}
        </div>
      </div>

      {/* Suggestions Section */}
      <div
        style={{
          flex: 1,
          background: "#1e1e1e",
          padding: "10px",
          overflowY: "auto",
          borderRadius: "5px",
        }}
      >
        <h3 style={{ borderBottom: "1px solid #555", paddingBottom: "5px" }}>
          Gemini Suggestions
        </h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{suggestion}</pre>
      </div>
    </div>
  );
};

export default Editor;
