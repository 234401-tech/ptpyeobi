import { useRef, useState } from "react";
import { FileText, Sparkles, X, Upload } from "lucide-react";
import { Card, CardHeader } from "./ui/Card.jsx";

const ACCEPT = [".pdf", ".jpg", ".jpeg", ".png"];

function isAccepted(file) {
  const name = (file.name || "").toLowerCase();
  return ACCEPT.some((ext) => name.endsWith(ext));
}

export function UploadCard({ filename, pages, onPick, onClear, busy }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState(false);

  const onChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    setRejected(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isAccepted(f)) {
      setRejected(true);
      setTimeout(() => setRejected(false), 2200);
      return;
    }
    onPick(f);
  };

  return (
    <Card>
      <CardHeader num={1} title="증빙서류 업로드" />
      <div className="px-5 pb-5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={onChange}
        />
        {filename ? (
          <div
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-4 flex items-center gap-4 transition ${
              dragOver
                ? "border-indigo-500 bg-indigo-100"
                : "border-indigo-100 bg-indigo-50/30"
            }`}
          >
            <div className="w-11 h-11 bg-white border border-indigo-100 rounded-lg grid place-items-center text-indigo-600 flex-shrink-0">
              <FileText size={19} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{filename}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{pages != null ? `${pages} 페이지` : "파일 분석 중"}</span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-600 inline-flex items-center gap-1">
                  <Sparkles size={11} /> {busy ? "AI 추출 중…" : "AI 추출 완료"}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-700 p-1"
              onClick={onClear}
              aria-label="제거"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`w-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
              rejected
                ? "border-red-400 bg-red-50 text-red-700"
                : dragOver
                ? "border-indigo-500 bg-indigo-100 text-indigo-700"
                : "border-indigo-100 bg-indigo-50/30 text-slate-500 hover:bg-indigo-50/60 hover:border-indigo-200"
            }`}
          >
            <Upload
              size={20}
              className={
                rejected
                  ? "text-red-600"
                  : dragOver
                  ? "text-indigo-700"
                  : "text-indigo-500"
              }
            />
            <div className="text-sm">
              {rejected
                ? "허용 형식: PDF · JPG · PNG"
                : dragOver
                ? "여기에 놓으세요"
                : "증빙 PDF / 이미지를 끌어다 놓거나 클릭하세요"}
            </div>
            <div className={`text-[11px] ${rejected ? "text-red-600" : "text-slate-400"}`}>
              PDF · JPG · PNG
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
