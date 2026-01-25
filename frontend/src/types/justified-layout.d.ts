/**
 * Type declarations for justified-layout npm package.
 * @see https://github.com/flickr/justified-layout
 */
declare module 'justified-layout' {
    interface Box {
        aspectRatio: number;
        top: number;
        width: number;
        height: number;
        left: number;
    }

    interface JustifiedLayoutResult {
        containerHeight: number;
        widowCount: number;
        boxes: Box[];
    }

    interface JustifiedLayoutConfig {
        containerWidth?: number;
        containerPadding?: number | { top?: number; right?: number; bottom?: number; left?: number };
        boxSpacing?: number | { horizontal?: number; vertical?: number };
        targetRowHeight?: number;
        targetRowHeightTolerance?: number;
        maxNumRows?: number;
        forceAspectRatio?: number | false;
        showWidows?: boolean;
        fullWidthBreakoutRowCadence?: number | false;
    }

    function justifiedLayout(
        input: number[] | Array<{ width: number; height: number }>,
        config?: JustifiedLayoutConfig
    ): JustifiedLayoutResult;

    export = justifiedLayout;
}
