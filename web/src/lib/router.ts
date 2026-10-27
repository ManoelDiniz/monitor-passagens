import { useEffect, useState } from 'react';

/**
 * Roteador por hash. Sem dependência e sem configuração de servidor: o Fastify
 * serve um index.html só, e recarregar /#/alertas continua caindo na página certa.
 */
export function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : '/';
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function useHashRoute(): string {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return path;
}
