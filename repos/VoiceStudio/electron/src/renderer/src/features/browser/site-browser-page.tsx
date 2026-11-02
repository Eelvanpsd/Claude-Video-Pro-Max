import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  GlobeIcon,
  RotateCwIcon,
  XIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '@/components/bridge';
import { Button } from '@/components/ui/button';
import { browserUrl, type InstalledBrowser, type SiteBrowserState } from '@shared/site-browser';
import './site-browser-page.css';

const initialState: SiteBrowserState = {
  url: '',
  title: '',
  loading: true,
  canGoBack: false,
  canGoForward: false,
  error: false,
};

export function SiteBrowserPage({ anchor = null }: { anchor?: HTMLElement | null }) {
  const { t } = useTranslation();
  const browser = getBridge()?.browser;
  const toolbar = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(initialState);
  const [address, setAddress] = useState('');
  const [browsers, setBrowsers] = useState<InstalledBrowser[]>([]);
  const [showBrowsers, setShowBrowsers] = useState(false);
  const [error, setError] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    }
  };

  // Keep the native web view inside the measured modal body, including when
  // controls expand, the window is resized, or the renderer zoom changes.
  useLayoutEffect(() => {
    if (!browser || !dialog.current || !viewport.current) return;
    const modal = dialog.current;
    modal.showModal?.();
    const workspace =
      anchor?.closest('[data-slot="workspace-content"]') ??
      document.querySelector('[data-slot="workspace-content"]');
    let active = true;
    const measure = () => {
      const area = workspace?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      };
      const left = Math.max(0, area.left) + 16;
      const right = Math.min(window.innerWidth, area.right) - 16;
      const bottom = Math.min(window.innerHeight, area.bottom) - 16;
      const width = Math.max(0, Math.min(900, right - left));
      const target = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
      const x = Math.max(left, Math.min(target?.left ?? left, right - width));
      const y = Math.max(
        area.top + 12,
        Math.min(target ? target.bottom + 12 : area.top + 64, bottom - 280),
      );
      Object.assign(modal.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${Math.max(0, Math.min(640, bottom - y))}px`,
      });
      const rect = viewport.current!.getBoundingClientRect();
      void browser
        .bounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
        .catch(() => {
          if (active) setError(true);
        });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current);
    if (workspace) observer.observe(workspace);
    if (anchor) observer.observe(anchor);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    measure();
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [browser, anchor, showBrowsers, browsers.length, error, page.error]);

  useEffect(() => {
    if (!browser) {
      setError(true);
      return;
    }
    let active = true;
    let received = false;
    const update = (state: SiteBrowserState | null) => {
      if (active && state) setPage(state);
    };
    const unsubscribe = browser.onState((state) => {
      received = true;
      update(state);
    });
    void browser
      .state()
      .then((state) => {
        if (!received) update(state);
      })
      .catch(() => {
        if (active) setError(true);
      });
    void browser
      .installed()
      .then((list) => {
        if (active) setBrowsers(list);
      })
      .catch(() => {
        /* System default remains available. */
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [browser]);

  useEffect(() => {
    setAddress(page.url);
  }, [page.url]);
  return (
    <dialog
      ref={dialog}
      className="site-browser-page"
      aria-label={t('siteBrowser.preview')}
      onCancel={(event) => {
        event.preventDefault();
        void run(() => browser!.close());
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          void run(() => browser!.close());
      }}
    >
      <header ref={toolbar} className="site-browser-toolbar">
        <div className="site-browser-title">
          <Button
            variant="ghost"
            size="sm"
            autoFocus
            onClick={() => void run(() => browser!.close())}
          >
            <XIcon aria-hidden="true" />
            {t('siteBrowser.return_studio')}
          </Button>
          <GlobeIcon size={15} aria-hidden="true" />
          <span>{page.title || t('app.name')}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showBrowsers}
            aria-controls="external-browsers"
            onClick={() => setShowBrowsers((value) => !value)}
          >
            <ExternalLinkIcon aria-hidden="true" />
            {t('siteBrowser.open_in')}
            <ChevronDownIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="site-browser-navigation">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('siteBrowser.back')}
            title={t('siteBrowser.back')}
            disabled={!page.canGoBack}
            onClick={() => void run(() => browser!.command('back'))}
          >
            <ArrowLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('siteBrowser.forward')}
            title={t('siteBrowser.forward')}
            disabled={!page.canGoForward}
            onClick={() => void run(() => browser!.command('forward'))}
          >
            <ArrowRightIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t(page.loading ? 'siteBrowser.stop' : 'siteBrowser.reload')}
            title={t(page.loading ? 'siteBrowser.stop' : 'siteBrowser.reload')}
            onClick={() => void run(() => browser!.command(page.loading ? 'stop' : 'reload'))}
          >
            {page.loading ? <XIcon /> : <RotateCwIcon />}
          </Button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => browser!.navigate(browserUrl(address)));
            }}
          >
            <input
              aria-label={t('siteBrowser.address')}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              dir="ltr"
              type="text"
            />
          </form>
        </div>
        {showBrowsers && (
          <div
            id="external-browsers"
            className="site-browser-external"
            aria-label={t('siteBrowser.open_in')}
          >
            {[{ id: 'default', name: t('siteBrowser.default_browser') }, ...browsers].map(
              (item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  size="sm"
                  onClick={() => void run(() => browser!.openExternal(item.id))}
                >
                  <ExternalLinkIcon aria-hidden="true" />
                  {item.name}
                </Button>
              ),
            )}
          </div>
        )}
        {(page.error || error) && (
          <p role="alert" className="site-browser-error">
            {t('siteBrowser.failed')}
          </p>
        )}
        <div className="site-browser-progress" data-loading={page.loading} aria-hidden="true" />
      </header>
      <div ref={viewport} className="site-browser-viewport" />
    </dialog>
  );
}
