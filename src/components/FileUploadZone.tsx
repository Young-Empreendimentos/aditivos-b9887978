import { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  accept: string;
  label: string;
  description: string;
  file: File | null;
  onFileSelect: (file: File) => void;
}

export function FileUploadZone({ accept, label, description, file, onFileSelect }: FileUploadZoneProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) onFileSelect(f);
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) onFileSelect(f);
    },
    [onFileSelect]
  );

  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5',
        file ? 'border-primary/40 bg-primary/5' : 'border-border'
      )}
    >
      <Upload className={cn('w-8 h-8', file ? 'text-primary' : 'text-muted-foreground')} />
      <div className="text-center">
        <p className="text-sm font-medium">{file ? file.name : label}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <input type="file" accept={accept} onChange={handleChange} className="hidden" />
    </label>
  );
}
