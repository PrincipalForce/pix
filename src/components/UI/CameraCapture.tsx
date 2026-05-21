import React, { useRef } from "react";
import Webcam from "react-webcam";
import Modal from "./Modal";

interface Props {
  onCapture: (imageSrc: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const webcamRef = useRef<Webcam>(null);

  return (
    <Modal title="Capture from Camera" onClose={onClose} width={760}>
      <div className="webcam-wrap">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/png"
          videoConstraints={{ width: 1920, height: 1080, facingMode: "user" }}
          className="webcam"
        />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const src = webcamRef.current?.getScreenshot();
            if (src) onCapture(src);
          }}
        >
          Capture
        </button>
      </div>
    </Modal>
  );
}
