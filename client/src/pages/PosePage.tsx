import { useRef, useState } from "react";
import PoseDetection from "@/components/PoseDetection"; // chỉnh lại path nếu khác

export default function PosePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posture, setPosture] = useState(0);
  const [repCount, setRepCount] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-black text-white">
      <h1 className="text-xl mb-2">Pose Detection (Real-time)</h1>
      <div className="relative w-full max-w-3xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-lg"
          onCanPlay={(e) => (e.currentTarget.play())}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
      </div>
      <p className="mt-4">Posture Score: {posture}</p>
      <p>Reps: {repCount}</p>

      <PoseDetection
        videoRef={videoRef}
        canvasRef={canvasRef}
        isActive={true}
        onPostureUpdate={setPosture}
        onRepCount={setRepCount}
      />
    </div>
  );
}
