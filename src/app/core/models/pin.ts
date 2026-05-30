import { Reply } from "./reply";

export interface Pin {
    id: string;
    num: number;
    x: number;
    y: number;
    color: string;
    auth: string;
    av: string;
    userId: string;
    sessId: string;
    title: string;
    txt: string;
    tags: string[];
    votes: number;
    voted: boolean;
    time: string;
    resolved: boolean;
    roadmap: boolean;
    rmap_cat: string;
    link: string;
    replies: Reply[];
}
