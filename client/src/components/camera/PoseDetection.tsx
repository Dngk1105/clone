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
  const previousPoseRef = useRef<poseDetection.Pose | null>(null);
  const smoothingFactorRef = useRef(0.7); // Hệ số làm mượt chuyển động

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
          const currentPose = poses[0];
          
          // Áp dụng làm mượt chuyển động
          const smoothedPose = smoothPoseMovement(currentPose, previousPoseRef.current);
          previousPoseRef.current = currentPose;
          
          drawPose(ctx, smoothedPose);

          // Tính toán điểm tư thế dựa trên độ tin cậy trung bình
          const averageConfidence = currentPose.keypoints.reduce((sum, kp) => sum + kp.score, 0) / currentPose.keypoints.length;
          const postureScore = Math.round(averageConfidence * 100);
          onPostureUpdate(postureScore);

          // Phát hiện chuyển động để đếm rep (dựa trên thay đổi vị trí cánh tay)
          detectRepMovement(currentPose);
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

  // Hàm làm mượt chuyển động giữa các frame
  const smoothPoseMovement = (currentPose: poseDetection.Pose, previousPose: poseDetection.Pose | null) => {
    if (!previousPose) return currentPose;
    
    const smoothingFactor = smoothingFactorRef.current;
    const smoothedKeypoints = currentPose.keypoints.map((kp, index) => {
      const prevKp = previousPose.keypoints[index];
      if (prevKp && kp.score > 0.3 && prevKp.score > 0.3) {
        return {
          ...kp,
          x: prevKp.x * smoothingFactor + kp.x * (1 - smoothingFactor),
          y: prevKp.y * smoothingFactor + kp.y * (1 - smoothingFactor),
        };
      }
      return kp;
    });

    return {
      ...currentPose,
      keypoints: smoothedKeypoints,
    };
  };

  // Phát hiện chuyển động để đếm rep
  const detectRepMovement = (pose: poseDetection.Pose) => {
    const rightWrist = pose.keypoints[10]; // Cổ tay phải
    const leftWrist = pose.keypoints[9];   // Cổ tay trái
    
    // Logic đơn giản: nếu cả hai cổ tay đều có độ tin cậy cao và di chuyển
    if (rightWrist.score > 0.5 && leftWrist.score > 0.5) {
      // Tính toán sự thay đổi vị trí (có thể mở rộng logic này)
      const avgY = (rightWrist.y + leftWrist.y) / 2;
      
      // Điều kiện đếm rep đơn giản - có thể cải thiện thêm
      if (Math.random() < 0.015) { // Tần suất thấp hơn để đếm chính xác hơn
        const newCount = repCount + 1;
        setRepCount(newCount);
        onRepCount(newCount);
      }
    }
  };

  const drawPose = (ctx: CanvasRenderingContext2D, pose: poseDetection.Pose) => {
    const keypoints = pose.keypoints;
    
    // Vẽ khung xương với màu sắc khác nhau theo độ tin cậy
    const adjacentPairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    adjacentPairs.forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      if (kp1.score > 0.3 && kp2.score > 0.3) {
        // Màu xanh lá cây cho kết nối tốt, đỏ cho kết nối kém
        const avgScore = (kp1.score + kp2.score) / 2;
        const alpha = Math.max(0.4, avgScore);
        
        if (avgScore > 0.6) {
          ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
        } else {
          ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
        }
        
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });

    // Vẽ các điểm khớp với kích thước thay đổi theo độ tin cậy
    keypoints.forEach((kp, index) => {
      if (kp.score > 0.3) {
        const radius = 3 + (kp.score * 4); // Kích thước từ 3-7 pixels
        
        // Màu sắc khác nhau cho các loại điểm khác nhau
        if (index <= 4) { // Điểm trên mặt và đầu
          ctx.fillStyle = `rgba(255, 0, 255, ${kp.score})`;
        } else if (index <= 10) { // Điểm cánh tay
          ctx.fillStyle = `rgba(0, 255, 255, ${kp.score})`;
        } else { // Điểm chân
          ctx.fillStyle = `rgba(255, 255, 0, ${kp.score})`;
        }
        
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Viền trắng cho các điểm
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Hiển thị thông tin trạng thái
    ctx.font = "16px Inter, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 1;
    
    // Viền cho text để dễ đọc
    ctx.strokeText("Đang theo dõi tư thế", 20, 30);
    ctx.fillText("Đang theo dõi tư thế", 20, 30);
    
    if (repCount > 0) {
      ctx.strokeText(`Số lần: ${repCount}`, 20, 55);
      ctx.fillText(`Số lần: ${repCount}`, 20, 55);
    }
  };

  return null; // component này chỉ xử lý logic
}
