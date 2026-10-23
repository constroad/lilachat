import { useState } from 'react';
import { Bot } from 'lucide-react';

/** An app's logo (its `avatar_url`, an SVG works), or the robot on the accent when it has none or it does not load. */
export function AppLogo(props: { avatarUrl?: string; size: number; rounded?: string }) {
  const rounded = props.rounded ?? 'rounded-lg';
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (props.avatarUrl && failedUrl !== props.avatarUrl) return <img src={props.avatarUrl} alt="" onError={() => setFailedUrl(props.avatarUrl ?? null)} className={`shrink-0 object-cover ${rounded}`} style={{ width: props.size, height: props.size }} />;
  return (
    <span className={`grid shrink-0 place-items-center bg-primary text-on-primary ${rounded}`} style={{ width: props.size, height: props.size }}>
      <Bot size={Math.round(props.size * 0.6)} />
    </span>
  );
}

/** The small «APP» mark next to an app's name (designs e-23 to e-26). */
export function AppBadge() {
  return <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">App</span>;
}
