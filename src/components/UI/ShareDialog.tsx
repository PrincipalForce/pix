import React, { useState } from "react";

interface ShareDialogProps {
  canvas: HTMLCanvasElement | null;
  onClose: () => void;
}

export default function ShareDialog({ canvas, onClose }: ShareDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const uploadToImgur = async (): Promise<string> => {
    if (!canvas) throw new Error('No canvas to upload');

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }

        const formData = new FormData();
        formData.append('image', blob);

        try {
          const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
              'Authorization': 'Client-ID 546c25a59c58ad7' // Public Imgur client ID for demos
            },
            body: formData
          });

          const data = await response.json();
          
          if (data.success) {
            resolve(data.data.link);
          } else {
            reject(new Error(data.data.error || 'Upload failed'));
          }
        } catch (error) {
          reject(error);
        }
      }, 'image/png');
    });
  };

  const handleUpload = async () => {
    if (!canvas) {
      alert('No image to share');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadToImgur();
      setShareUrl(url);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const shareToSocialMedia = (platform: string) => {
    const text = 'Check out my edited image!';
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(shareUrl);

    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      reddit: `https://www.reddit.com/submit?title=${encodedText}&url=${encodedUrl}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      tumblr: `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodedUrl}&title=${encodedText}`
    };

    const url = urls[platform as keyof typeof urls];
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Share Your Creation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {!shareUrl ? (
          <div className="text-center">
            <p className="text-gray-300 mb-6">
              Upload your image to get a shareable link
            </p>
            <button
              onClick={handleUpload}
              disabled={!canvas || isUploading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </span>
              ) : (
                '🌐 Upload to Share'
              )}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Images are uploaded to Imgur for sharing
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Share URL */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Share Link</label>
              <div className="flex">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="form-input rounded-r-none flex-1"
                />
                <button
                  onClick={copyToClipboard}
                  className={`px-3 py-2 rounded-l-none border border-l-0 border-gray-600 transition-colors ${
                    copySuccess
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {copySuccess ? '✓' : '📋'}
                </button>
              </div>
            </div>

            {/* Social Media Sharing */}
            <div>
              <label className="block text-sm text-gray-300 mb-3">Share on Social Media</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => shareToSocialMedia('twitter')}
                  className="flex items-center justify-center p-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                  title="Share on Twitter"
                >
                  🐦
                </button>
                <button
                  onClick={() => shareToSocialMedia('facebook')}
                  className="flex items-center justify-center p-2 bg-blue-700 hover:bg-blue-800 rounded transition-colors"
                  title="Share on Facebook"
                >
                  📘
                </button>
                <button
                  onClick={() => shareToSocialMedia('reddit')}
                  className="flex items-center justify-center p-2 bg-orange-600 hover:bg-orange-700 rounded transition-colors"
                  title="Share on Reddit"
                >
                  🤖
                </button>
                <button
                  onClick={() => shareToSocialMedia('pinterest')}
                  className="flex items-center justify-center p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                  title="Share on Pinterest"
                >
                  📌
                </button>
                <button
                  onClick={() => shareToSocialMedia('linkedin')}
                  className="flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  title="Share on LinkedIn"
                >
                  💼
                </button>
                <button
                  onClick={() => shareToSocialMedia('tumblr')}
                  className="flex items-center justify-center p-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                  title="Share on Tumblr"
                >
                  📝
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-xs text-gray-400 mb-2">Preview:</div>
              <img
                src={shareUrl}
                alt="Shared image preview"
                className="w-full h-32 object-contain bg-gray-600 rounded"
              />
            </div>
          </div>
        )}

        <div className="flex space-x-3 mt-6">
          <button onClick={onClose} className="flex-1 btn-secondary">
            {shareUrl ? 'Done' : 'Cancel'}
          </button>
          {shareUrl && (
            <button
              onClick={() => {
                setShareUrl('');
                setCopySuccess(false);
              }}
              className="flex-1 btn-secondary"
            >
              Upload New
            </button>
          )}
        </div>
      </div>
    </div>
  );
}