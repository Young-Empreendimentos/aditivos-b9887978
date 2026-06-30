import { useEffect, useState } from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value: Date | null;
  onChange: (d: Date | null) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}

/** Aplica máscara dd/mm/aaaa enquanto o usuário digita. */
function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length >= 3) out += '/' + d.slice(2, 4);
  if (d.length >= 5) out += '/' + d.slice(4, 8);
  return out;
}

function tryParse(text: string): Date | null {
  if (text.length !== 10) return null;
  const parsed = parse(text, 'dd/MM/yyyy', new Date());
  if (!isValid(parsed)) return null;
  const year = parsed.getFullYear();
  if (year < 1900 || year > 2200) return null;
  return parsed;
}

/**
 * Campo de data que aceita digitação manual (dd/mm/aaaa) E seleção pelo calendário.
 */
export function DateInput({ value, onChange, id, placeholder = 'dd/mm/aaaa', className }: DateInputProps) {
  const [text, setText] = useState(value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : '');

  // Sincroniza o texto quando a data muda por fora (calendário, edição externa).
  useEffect(() => {
    setText(value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : '');
  }, [value]);

  const handleText = (raw: string) => {
    const masked = maskDate(raw);
    setText(masked);
    if (masked === '') {
      onChange(null);
      return;
    }
    const parsed = tryParse(masked);
    if (parsed) onChange(parsed);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        onChange={(e) => handleText(e.target.value)}
        className="tabular-nums"
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Abrir calendário">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(d) => onChange(d ?? null)}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
