import { spaceInitials, type ClientWorkspace } from '@lilachat/shared';

/** A space's square logo: its picture, or its initials on the accent (design `e1-04`). */
export function SpaceLogo({ space, size }: { space: Pick<ClientWorkspace, 'name' | 'logoUrl'>; size: number }) {
  const style = { width: size, height: size, borderRadius: size * 0.25 };
  if (space.logoUrl) return <img src={space.logoUrl} alt="" style={style} className="shrink-0 object-cover" />;
  return (
    <span aria-hidden style={{ ...style, fontSize: size * 0.36 }} className="grid shrink-0 place-items-center bg-primary font-bold text-on-primary">
      {spaceInitials(space.name)}
    </span>
  );
}
