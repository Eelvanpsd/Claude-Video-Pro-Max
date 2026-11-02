import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getBridge } from '@/components/bridge';
import { SiteBrowserPage } from './site-browser-page';

/** Preserve the workspace and its drafts while browsing inside the same window. */
export function SiteBrowserHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const browser = getBridge()?.browser;
    if (!browser) return;
    let active = true;
    let received = false;
    const update = (isOpen: boolean) => {
      if (!active) return;
      if (isOpen && !returnFocus.current)
        returnFocus.current = document.activeElement as HTMLElement;
      setOpen(isOpen);
    };
    const unsubscribe = browser.onState((state) => {
      received = true;
      update(Boolean(state));
    });
    void browser
      .state()
      .then((state) => {
        if (!received) update(Boolean(state));
      })
      .catch(() => {});
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [open]);
  return (
    <>
      <div
        data-slot="studio-workspace"
        className="h-full"
        inert={open}
        aria-hidden={open || undefined}
      >
        {children}
      </div>
      {open && <SiteBrowserPage anchor={returnFocus.current} />}
    </>
  );
}
