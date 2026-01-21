/**
 * FileUpload - File upload with progress using React Hook Form
 */

import { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import type { ModuleBlock } from '@autoart/shared';

interface FileUploadProps {
  block: ModuleBlock;
}

export function FileUpload({ block }: FileUploadProps) {
  const { control, setValue } = useFormContext();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const endpoint = block.uploadEndpoint ?? '/api/upload';
      const formData = new FormData();
      formData.append('file', file);

      // Using fetch with progress simulation (XHR for real progress)
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      const url = result.url || result.path || `uploaded:${file.name}`;

      setUploadedUrl(url);
      setUploadProgress(100);
      setValue(block.id, url, { shouldValidate: true });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Controller
      name={block.id}
      control={control}
      defaultValue=""
      render={({ fieldState }) => (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            {block.label}
            {block.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {block.description && (
            <p className="text-sm text-slate-500">{block.description}</p>
          )}

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${uploadedUrl
                ? 'border-green-300 bg-green-50'
                : 'border-slate-300 hover:border-blue-400'
              }`}
          >
            {uploadedUrl ? (
              <div className="text-green-700">
                <svg
                  className="w-8 h-8 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p className="text-sm">File uploaded successfully</p>
              </div>
            ) : (
              <>
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <label className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-700">
                    Choose a file
                  </span>
                  <span className="text-slate-500"> or drag and drop</span>
                  <input
                    type="file"
                    className="hidden"
                    accept={block.acceptedFileTypes?.join(',')}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(file);
                    }}
                    disabled={isUploading}
                  />
                </label>
                {block.acceptedFileTypes && (
                  <p className="text-xs text-slate-400 mt-2">
                    Accepted: {block.acceptedFileTypes.join(', ')}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Errors */}
          {uploadError && (
            <p className="text-sm text-red-500">{uploadError}</p>
          )}
          {fieldState.error && (
            <p className="text-sm text-red-500">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
