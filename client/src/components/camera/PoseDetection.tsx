import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

interface PoseDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  onPostureUpdate: (score: number) => void;
  onRepCount: (count: number) => void;
}

export default function PoseDetection({
  videoRef,
  canvasRef,
  isActive,
  onPostureUpdate,
  onRepCount,
}: PoseDetectionProps) {
  const animationRef = useRef<number>();
  const [repCount, setRepCount] = useState(0);

  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    let detector: poseDetection.PoseDetector | null = null;
    let rafId: number;

    const loadDetector = async () => {
      try {
        // Initialize TensorFlow backend
        await tf.ready();
        
        detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
        
        startDetection();
      } catch (error) {
        console.error('Failed to load pose detector:', error);
      }
    };

    const startDetection = async () => {
      const detect = async () => {
        if (!videoRef.current || !canvasRef.current || !detector) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const poses = await detector.estimatePoses(video);
        if (poses && poses.length > 0) {
          drawPose(ctx, poses[0]);

          // Cập nhật posture giả định (chấm điểm tạm thời)
          onPostureUpdate(100);

          // Đếm rep ngẫu nhiên (bạn có thể thay bằng logic thực tế)
          if (Math.random() < 0.02) {
            const newCount = repCount + 1;
            setRepCount(newCount);
            onRepCount(newCount);
          }
        }

        rafId = requestAnimationFrame(detect);
      };

      detect();
    };

    loadDetector();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (detector?.dispose) detector.dispose();
    };
  }, [isActive, repCount, onPostureUpdate, onRepCount, videoRef, canvasRef]);

  const drawPose = (ctx: CanvasRenderingContext2D, pose: poseDetection.Pose) => {
    const keypoints = pose.keypoints;
    ctx.strokeStyle = "rgba(0,255,0,0.6)";
    ctx.fillStyle = "rgba(255,0,0,0.8)";
    ctx.lineWidth = 2;

    // Vẽ khung xương giữa các cặp điểm
    const adjacentPairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    adjacentPairs.forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      if (kp1.score > 0.4 && kp2.score > 0.4) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });

    // Vẽ các điểm khớp (keypoints)
    keypoints.forEach((kp) => {
      if (kp.score > 0.4) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Hiển thị số rep hiện tại
    ctx.font = "16px Inter, sans-serif";
    ctx.fillStyle = "white";
    ctx.fillText("Pose tracking active", 20, 30);
    if (repCount > 0) {
      ctx.fillText(`Reps: ${repCount}`, 20, 55);
    }
  };

  return null; // component này chỉ xử lý logic
}
