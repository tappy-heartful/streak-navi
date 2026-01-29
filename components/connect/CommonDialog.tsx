"use client";

import { useState, useEffect } from "react";
export interface DialogOptions {
  message: string;
  isOKOnly?: boolean;
  resolve: (value: boolean) => void;
}

// グローバルに呼び出すためのイベントリスナー用
let setter: (options: any) => void;

export const showDialog = (message: string, isOKOnly = false): Promise<boolean> => {
  return new Promise((resolve) => {
    if (setter) {
      setter({ message, isOKOnly, resolve });
    }
  });
};

export default function CommonDialog() {
  const [options, setOptions] = useState<DialogOptions | null>(null);

  useEffect(() => {
    setter = setOptions;
  }, []);

  if (!options) return null;

  const handleClose = (result: boolean) => {
    options.resolve(result);
    setOptions(null);
  };

  return (
    <div className="dialog-overlay">
      <style jsx>{`
        .dialog-overlay {
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          background-color: rgba(0, 0, 0, 0.85);
          display: flex; align-items: center; justify-content: center;
          z-index: 10001;
        }
        .dialog-box {
          background: #111;
          padding: 30px 20px;
          border-radius: 16px;
          width: 90%; max-width: 400px;
          text-align: center;
          box-shadow: 0 0 20px rgba(231, 33, 26, 0.3);
          border: 1px solid #333;
        }
        #dialog-message {
          font-size: 1.1rem; line-height: 1.6;
          margin-bottom: 25px; color: #fff; font-weight: bold;
          white-space: pre-wrap; /* 改行を有効にする */
        }
        .dialog-buttons { display: flex; justify-content: center; gap: 15px; }
        button {
          padding: 10px 30px; font-size: 0.95rem; font-weight: bold;
          cursor: pointer; border-radius: 4px; transition: all 0.3s ease;
          min-width: 100px; font-family: 'Impact', sans-serif;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        .dialog-ok { background-color: #e7211a; color: #fff; border: none; }
        .dialog-ok:hover { opacity: 0.8; box-shadow: 0 0 10px rgba(231, 33, 26, 0.5); }
        .dialog-cancel { background-color: transparent; color: #888; border: 1px solid #444; }
        .dialog-cancel:hover { background: rgba(255, 255, 255, 0.05); color: #fff; border-color: #888; }
      `}</style>
      <div className="dialog-box">
        <p id="dialog-message">{options.message}</p>
        <div className="dialog-buttons">
          <button className="dialog-ok" onClick={() => handleClose(true)}>
            {options.isOKOnly ? "OK" : "はい"}
          </button>
          {!options.isOKOnly && (
            <button className="dialog-cancel" onClick={() => handleClose(false)}>
              いいえ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}