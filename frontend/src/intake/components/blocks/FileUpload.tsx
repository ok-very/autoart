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

  /**
   * Validates if a file matches the accepted file types.
   * Supports MIME types (image/*, application/pdf) and extensions (.pdf, .jpg)
   */
  const validateFileType = (file: File): { valid: boolean; error?: string } => {
    const acceptedTypes = block.acceptedFileTypes;
    if (!acceptedTypes || acceptedTypes.length === 0) {
      return { valid: true };
    }

    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    const fileExtension = '.' + fileName.split('.').pop();

    for (const accepted of acceptedTypes) {
      const normalizedAccepted = accepted.toLowerCase().trim();

      // Check extension match (e.g., .pdf, .jpg)
      if (normalizedAccepted.startsWith('.')) {
        if (fileExtension === normalizedAccepted) {
          return { valid: true };
        }
        continue;
      }

      // Check MIME type match
      if (normalizedAccepted.includes('/')) {
        // Wildcard MIME type (e.g., image/*)
        if (normalizedAccepted.endsWith('/*')) {
          const mimeCategory = normalizedAccepted.slice(0, -2);
          if (fileType.startsWith(mimeCategory + '/')) {
            return { valid: true };
          }
        } else if (fileType === normalizedAccepted) {
          // Exact MIME type match
          return { valid: true };
        }
      }
    }

    return {
      valid: false,
      error: `File type not allowed. Accepted: ${acceptedTypes.join(', ')}`,
    };
  };

  const uploadFile = async (file: File) => {
    // Validate file type before uploading
    const validation = validateFileType(file);
    if (!validation.valid) {
      setUploadError(validation.error ?? 'Invalid file type');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const endpoint = block.uploadEndpoint ?? '/api/upload';
      const formData = new FormData();
      formData.append('file', file);

      // Use XMLHttpRequest to track upload progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              const url = result.url || result.path || `uploaded:${file.name}`;
              setUploadedUrl(url);
              setValue(block.id, url, { shouldValidate: true });
              resolve();
            } catch (_err) {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error('Upload failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload aborted'));

        xhr.send(formData);
      });

      setUploadProgress(100);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  return (
    <Controller
      name={block.id}
      control={control}
      defaultValue=""
      render={({ fieldState }) => (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-pub-text-secondary">
            {block.label}
            {block.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {block.description && (
            <p className="text-sm text-pub-text-secondary">{block.description}</p>
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
                  className="w-8 h-8 mx-auto mb-2 text-pub-muted"
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
                <label
                  className="cursor-pointer block w-full h-full"
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDrop={handleDrop}
                >
                  <span className="text-blue-600 hover:text-blue-700">
                    Choose a file
                  </span>
                  <span className="text-pub-text-secondary"> or drag and drop</span>
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
                  <p className="text-xs text-pub-muted mt-2">
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
