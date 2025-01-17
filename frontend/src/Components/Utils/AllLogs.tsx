import { useContext, useRef, useState } from "react";
import { AppContext, socket } from "../../App";
import { getLocal, incomingSockets, runOnce } from "../Helpers/funcs";
import { ALog, EntryData } from "../../../../types";
import LogEl from "./LogEl";
import useWindowWidth from "../Hooks/useWindowWidth";
import { useAtom } from "jotai";
import { ShowPlaceholderAtom } from "../Helpers/atoms";
import AllLogsPlaceholder from "./Placeholders/AllLogsPh";

type Props = {
    heading?: string,
    filterTag?: string,
    aHashtag?: boolean,
    headingBtnFunc?: () => void,
}
export default function AllLogs(props: Props) {

    const { sessionId } = getLocal('entryData') as EntryData;

    const { setLoadScreen, setNewLogScreen } = useContext(AppContext);
    const [logs, setLogs] = useState<ALog[]>([]);
    const [lastId, setLastId] = useState<string|null>(null);
    const [isLastLog, setIsLastLog] = useState(false);
    const windowWidth = useWindowWidth();
    const [showPlaceholder, setShowPlaceholder] = useAtom(ShowPlaceholderAtom);

    const allLogsEl = useRef<HTMLDivElement>(null);
    const loaderEl = useRef<HTMLDivElement>(null);

    function allLogsScrolled(e: React.UIEvent<HTMLDivElement, UIEvent>) {
        const {scrollHeight, scrollTop, clientHeight} = e.currentTarget;

        const scroll = Math.abs(scrollHeight - clientHeight - scrollTop);
        if (scroll < 1) {
            socket.emit('get-logs', sessionId, lastId, props.filterTag);
        }
    }

    runOnce(() => {
        setShowPlaceholder(true);
        socket.emit('get-logs', sessionId, lastId, props.filterTag);
    });

    incomingSockets(() => {
        socket.on('parsed-logs', (newLogs: ALog[], lastLog: boolean) => {
            setIsLastLog(lastLog);
            if (newLogs && newLogs.length !== 0) {
                if (showPlaceholder) 
                    setShowPlaceholder(false);
                setLogs(prevLogs => prevLogs.concat(newLogs));
                setLastId(newLogs[newLogs.length - 1].id);
            }
        });

        socket.on('new-log', (newLog: ALog, me: boolean) => {
            if (!props.aHashtag || (props.aHashtag && newLog.hashtag == props.filterTag)) {
                setLogs(prev => [newLog, ...prev]);
                if (me && setLoadScreen && setNewLogScreen) {
                    setLoadScreen(false);
                    setNewLogScreen(false);
                }
            }
        });

        socket.on('update-like', (logId: string, totalLikes: number, userId: string, action: "plus"|"minus") => {
            setLogs(prev => {
                return prev.map(log => {
                    const alteredLog = { ...log };

                    if (log.id == logId) {
                        alteredLog.totalLikes = totalLikes;

                        if (socket.id == userId)
                            alteredLog.liked = action == 'plus' ? true : false;
                    }
                    return alteredLog;
                });
            });
        });
    });

    return <>
        {
            props.heading ? 
                <div className={"all-logs-title " + (props.aHashtag ? "all-logs-title-hastag" : "")}>
                    <div>{props.heading}</div>
                    {
                        /**<span>
                            <FontAwesomeIcon 
                                icon={faBars}
                                onClick={props.headingBtnFunc}
                            />
                        </span>*/
                    }
                </div>
            : ""
        }
        
        
        <div 
            className={
                "all-logs " + 
                    (props.aHashtag ? "all-logs-for-hashtag" : "") +
                    (showPlaceholder ? " all-logs-placeholder" : "")
            } 
            ref={allLogsEl} 
            onScroll={allLogsScrolled}
        >
            {
                showPlaceholder ?
                <AllLogsPlaceholder /> :
                logs.map((newLog, i) => {
                    let El = <LogEl
                        text={newLog.text} 
                        src={newLog.src} 
                        displayname={newLog.displayname}
                        username={newLog.username}
                        when={newLog.when}
                        id={newLog.id}
                        liked={newLog.liked}
                        totalLikes={newLog.totalLikes}
                        hashtag={newLog.hashtag ?? "unclassified"}
                        windowSize={windowWidth}
                        key={i}
                    />;

                    if (i == logs.length - 1 && !isLastLog) {
                        El = <div key={i}>
                            {El}
                            <div className="load-more-logs" id="loadMoreLogs" ref={loaderEl}>
                                <div className="loader"></div>
                            </div>
                        </div>
                    }

                    return El;
                })
            }
        </div>
    </>
}
