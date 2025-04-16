import { useLayoutEffect, useRef } from "react";
interface Props {
    /**
     * The HTMLElement to convert in a ReactNode
     */
    child: HTMLElement
}
/**
 * Add an HTMLElement in a React node easily
 * @returns 
 */
export default function VanillaHTMLConverter({ child }: Props) {
    useLayoutEffect(() => {
        ref.current?.append(child);
    }, []);
    const ref = useRef<HTMLSpanElement>(null);
    return <span ref={ref}></span>
}