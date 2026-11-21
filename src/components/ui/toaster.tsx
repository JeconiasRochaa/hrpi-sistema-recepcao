import { Toaster as Sonner } from 'sonner';
import { useTema } from '@/context/ThemeContext';

/** Toasts modernos (sonner) integrados ao tema. */
export function Toaster() {
  const { tema } = useTema();
  return (
    <Sonner
      theme={tema}
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast: '!rounded-lg !border !shadow-pop !font-sans !text-sm',
          title: '!font-semibold',
          description: '!text-[13px]',
        },
      }}
    />
  );
}
