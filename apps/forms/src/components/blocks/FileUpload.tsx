import { useState, useRef } from 'react';
import type { ModuleBlock } from '@autoart/shared';

interface FileUploadProps {
  block: ModuleBlock;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

export function FileUpload({ block, value, onChange, error }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    setUploadProgress(0);

    try {
      const endpoint = block.uploadEndpoint || '/api/upload';
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            resolve(data.url);
          } else {
            reject(new Error('Upload failed'));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      });

      xhr.open('POST', endpoint);
      xhr.send(formData);

      const url = await uploadPromise;
      onChange(url);
    } catch (err) {
      console.error('Upload error:', err);
      setFileName(null);
      onChange(null);
    } finally {
      setUploading(false);
    }
  };

  const acceptTypes = block.acceptedFileTypes?.join(',');

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {block.label}
        {block.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {block.description && (
        <p className="text-sm text-slate-500">{block.description}</p>
      )}

      <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
        error ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
      }`}>
        {value ? (
          <div className="space-y-2">
            <div className="text-green-600 font-medium">File uploaded</div>
            <div className="text-sm text-slate-500 truncate">{fileName || 'File'}</div>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setFileName(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ) : uploading ? (
          <div className="space-y-2">
            <div className="text-sm text-slate-600">Uploading {fileName}...</div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-xs text-slate-500">{uploadProgress}%</div>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              onChange={handleFileChange}
              accept={acceptTypes}
              className="hidden"
              id={`file-${block.id}`}
            />
            <label
              htmlFor={`file-${block.id}`}
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Choose file
            </label>
            <p className="text-xs text-slate-500">
              {acceptTypes ? `Accepted: ${acceptTypes}` : 'Any file type'}
            </p>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
