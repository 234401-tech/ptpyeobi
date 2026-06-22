import { useEffect, useState } from "react";

/**
 * Logo 컴포넌트 — public/logo.png 가 있으면 그걸 사용, 없으면 "뚝" 텍스트 fallback.
 *
 * 사용자가 직접 로고 파일을 `frontend/public/logo.png` 경로에 저장하면 자동 반영.
 * SVG/PNG 무관. 파일명만 일치하면 됨.
 */
export function Logo({ size = 36, rounded = true }) {
  const [hasFile, setHasFile] = useState(true);

  useEffect(() => {
    // 한 번만 확인 — 파일 없으면 fallback. 캐시 회피용 timestamp 없이 단순 fetch.
    fetch("/logo.png", { method: "HEAD" })
      .then((r) => setHasFile(r.ok))
      .catch(() => setHasFile(false));
  }, []);

  const px = `${size}px`;
  const cls = rounded ? "rounded-lg" : "";

  if (hasFile) {
    return (
      <img
        src="/logo.png"
        alt="여비뚝딱 로고"
        style={{ width: px, height: px, objectFit: "contain" }}
        className={cls}
        onError={() => setHasFile(false)}
      />
    );
  }
  // Fallback — 기존 "뚝" 배지
  return (
    <div
      style={{ width: px, height: px }}
      className={`${cls} bg-gradient-to-br from-indigo-600 to-indigo-800 text-white grid place-items-center font-bold`}
    >
      뚝
    </div>
  );
}
