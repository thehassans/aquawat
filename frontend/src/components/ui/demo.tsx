import React from 'react';
import { HighlightText } from "@/components/ui/highlight-text";

export default function HighlightTextDemo() {
  return (
    <div className="flex min-h-[300px] w-full items-center justify-center p-8">
      <p className="max-w-md text-center text-2xl font-semibold leading-relaxed text-foreground">
        Build interfaces that feel{" "}
        <HighlightText>effortless</HighlightText> and stay{" "}
        <HighlightText variant="yellow">delightful</HighlightText> for every{" "}
        <HighlightText variant="pink">user</HighlightText>.
      </p>
    </div>
  );
}

export { HighlightTextDemo };
