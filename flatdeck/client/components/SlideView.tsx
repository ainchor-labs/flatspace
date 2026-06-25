/**
 * SlideView — renders a single slide as a self-contained 16:9 surface.
 *
 * Pure presentation: parses the slide's layout directive, renders its markdown
 * body to HTML, and applies theme + layout classes. Sizing is container-query
 * based (see flatdeck.css), so the same component is reused at every scale:
 * editor preview, navigator thumbnail, present mode, and print.
 */

import { useMemo } from "react";
import { cn } from "@flatspace/shared/lib";
import { parseSlide, renderSlideHtml, type DeckTheme, type Slide } from "../lib/deck.ts";

export function SlideView({
  slide,
  theme,
  className,
}: {
  slide: Slide;
  theme: DeckTheme;
  className?: string;
}) {
  const { layout, html } = useMemo(
    () => ({ layout: parseSlide(slide.markdown).layout, html: renderSlideHtml(slide.markdown) }),
    [slide.markdown],
  );

  return (
    <div className={cn("deck-slide", `deck-theme-${theme}`, `slide-layout-${layout}`, className)}>
      <div className="deck-slide-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
