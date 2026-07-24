import { ImageResponse } from "next/og";

export const alt = "DevFlow developer community and browser code lab";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0f1117",
          color: "#ffffff",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#ff7000",
            borderRadius: 999,
            display: "flex",
            height: 360,
            opacity: 0.16,
            position: "absolute",
            right: -90,
            top: -100,
            width: 360,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            padding: "72px 92px",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 34,
              fontWeight: 700,
              gap: 12,
            }}
          >
            <span style={{ color: "#ff7000" }}>&lt;/&gt;</span>
            <span>DevFlow</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.08,
              maxWidth: 950,
            }}
          >
            Ask better questions.
            <span style={{ color: "#ff8a2d" }}>Build better software.</span>
          </div>
          <div
            style={{
              color: "#dce3f1",
              display: "flex",
              fontSize: 26,
            }}
          >
            Community answers · AI-assisted drafts · Isolated browser code lab
          </div>
        </div>
      </div>
    ),
    size,
  );
}
