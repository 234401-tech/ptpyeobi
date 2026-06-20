import { useRef, useState } from "react";
import { FileText, Sparkles, X, Upload, Loader2, ClipboardPaste } from "lucide-react";
import { Card, CardHeader } from "./ui/Card.jsx";

const ACCEPT = [".pdf", ".jpg", ".jpeg", ".png"];

function isAccepted(file) {
  const name = (file.name || "").toLowerCase();
  return ACCEPT.some((ext) => name.endsWith(ext));
}

export function UploadCard({ uploads, onPickFiles, onRemove, busy }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState(false);

  const handleFiles = (files) => {
    const arr = Array.from(files);
    const ok = arr.filter(isAccepted);
    const bad = arr.length - ok.length;
    if (bad > 0) {
      setRejected(true);
      setTimeout(() => setRejected(false), 2200);
    }
    if (ok.length) onPickFiles(ok);
  };

  const onChange = (e) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const hasFiles = uploads.length > 0;

  return (
    <Card>
      <CardHeader
        num={1}
        title="증빙서류 업로드"
        right={
          hasFiles && (
            <span className="text-xs text-slate-500">{uploads.length}개 파일</span>
          )
        }
      />
      <div className="px-5 pb-5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          className="hidden"
          onChange={onChange}
        />

        {/* 썸네일 미리보기 그리드 */}
        {hasFiles && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
            {uploads.map((u) => (
              <div
                key={u.id}
                className="relative border border-slate-200 rounded-md overflow-hidden bg-slate-50 group"
              >
                {/* 미리보기 */}
                {u.previewUrl ? (
                  <a
                    href={u.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="원본 보기"
                  >
                    <img
                      src={u.previewUrl}
                      alt={u.filename}
                      className="w-full h-24 object-cover bg-white"
                    />
                  </a>
                ) : (
                  <div className="w-full h-24 grid place-items-center text-slate-400 bg-white">
                    <FileText size={28} />
                  </div>
                )}
                {/* 삭제 버튼 */}
                <button
                  type="button"
                  onClick={() => onRemove(u.id)}
                  className="absolute top-1 right-1 w-5 h-5 grid place-items-center bg-white/90 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded shadow-sm"
                  title="제거"
                >
                  <X size={12} />
                </button>
                {/* 상태 배지 */}
                <div className="px-1.5 py-1 text-[10px] text-slate-700 flex items-center gap-1 truncate">
                  {u.busy ? (
                    <>
                      <Loader2 size={10} className="animate-spin text-indigo-600 flex-shrink-0" />
                      <span className="text-indigo-600 truncate">AI 추출 중…</span>
                    </>
                  ) : u.error ? (
                    <span className="text-red-600 truncate">{u.error}</span>
                  ) : (
                    <>
                      <Sparkles size={10} className="text-emerald-600 flex-shrink-0" />
                      <span className="text-slate-600 truncate">{u.filename}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 드롭존 — 항상 표시 (누적 추가용) */}
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
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`w-full border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
            rejected
              ? "border-red-400 bg-red-50 text-red-700"
              : dragOver
              ? "border-indigo-500 bg-indigo-100 text-indigo-700"
              : "border-indigo-100 bg-indigo-50/30 text-slate-500 hover:bg-indigo-50/60 hover:border-indigo-200"
          }`}
        >
          <Upload
            size={hasFiles ? 16 : 20}
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
              : hasFiles
              ? "증빙 더 추가 — 드래그 · 클릭 · Ctrl+V"
              : "증빙 PDF / 이미지를 끌어다 놓거나 클릭하세요"}
          </div>
          {!hasFiles && (
            <div
              className={`text-[11px] ${rejected ? "text-red-600" : "text-slate-400"} flex items-center gap-3`}
            >
              <span>PDF · JPG · PNG</span>
              <span className="inline-flex items-center gap-1 text-indigo-500">
                <ClipboardPaste size={11} /> Ctrl+V 캡처 붙여넣기
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
