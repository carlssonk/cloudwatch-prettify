import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useState } from "react"
import overrideCss from "data-text:../override.css"
import mainCss from "data-text:../main.css"
import { formatTwoDigits, getRowContainer, getTable, selector, stringToHex, waitForAnchor } from "./utils"
import { v4 as uuidv4 } from 'uuid';
import InfoIcon from "react:~/assets/info-lg.svg"
import WarnIcon from "react:~/assets/exclamation-triangle-fill.svg"
import ErrorIcon from "react:~/assets/x-circle-fill.svg"
import CaretLeft from "react:~/assets/caret-left-fill.svg"
import CaretDown from "react:~/assets/caret-down-fill.svg"
import JSONPretty from 'react-json-pretty';
import _ from "lodash";
import type { PlasmoRender } from "plasmo"
import { createRoot } from "react-dom/client"


type Loglevels = 'info' | 'warn' | 'error'
type Label = 'GUI' | 'SDK' | 'API' | 'GENERIC'

type Log = {
  id: string // specific to this script
  showMeta: boolean // specific to this script
  friendlyTime: string // specific to this script
  level: Loglevels
  msg: string
  data?: object
  meta: {
    service: string
    appVersion: string
    view: string
    sessionId: string
    deviceId: string
    label: Label
    username?: string
    correlationId?: string
    action?: string
    target?: string
  }
  timestamp: string // iso
}

const currentPageHasLogEvents = () => {
  const URL = window.location.href;
  return URL.includes('log-events')
}

const listenForPageNavigation = ({createRootContainer,InlineCSUIContainer}) => {
    let previousPageHadLogEvents = false;

    setInterval(() => {
      const pageHasLogEvents = currentPageHasLogEvents()
      if (!previousPageHadLogEvents && pageHasLogEvents) {
        previousPageHadLogEvents = true
        renderLogs({createRootContainer,InlineCSUIContainer})
      }

      if (!pageHasLogEvents) {
        previousPageHadLogEvents = false
      }
    }, 500);
}


async function renderLogs({createRootContainer,InlineCSUIContainer}) {
  const anchor = await waitForAnchor();
  const rootContainer = await createRootContainer(anchor)

  const root = createRoot(rootContainer) // Any root
  root.render(
    // @ts-ignore
    <InlineCSUIContainer>
      <PlasmoMainUI />
    </InlineCSUIContainer>
  )
}

export const render: PlasmoRender = (
  {
    createRootContainer // This creates the default root container
  },
  InlineCSUIContainer,
) => {
  listenForPageNavigation({ createRootContainer, InlineCSUIContainer })
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = mainCss
  return style
}

export const config: PlasmoCSConfig = {
  matches: [
    "https://eu-north-1.console.aws.amazon.com/*",
  ],
}

function PlasmoMainUI() {
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [hasInited, setHasInited] = useState(false)
  const [store] = useState({
    set: new Set(),
    prevLength: 0,
  })
  const [usernameColors, setUsernameColors] = useState({})

  const scrapeLogs = useCallback(() => {

      const rowContainer = getRowContainer()

      if (rowContainer) {

        const childNodesArray = [...rowContainer.childNodes]
        // childNodesArray should always be filled with more logs
        if (childNodesArray.length < store.prevLength) {
          // invalidate set if length is less than current nodes
          store.set.clear()
        }
        store.prevLength = childNodesArray.length

        // 2 = skip the Load more/Resume row and skip this ui compoonent
        // childNodesArray.length - 1 = skip the Load more/Resume row
        const slicedChildNodesArray = childNodesArray.slice(2, childNodesArray.length - 1)


        const createUsernameColors = {}

        const createLogs = slicedChildNodesArray.map((row: any) => {
          const timestamp = row.querySelector(selector.timestamp)?.innerText?.trim() as string
          if (!timestamp) return null
          const dateFromTimestamp = new Date(timestamp)

          const message = row.querySelector(selector.json)?.innerText?.trim() as string
          if (!message) return null
          
          const messageSplitIndexAt = message?.indexOf('-') + 1
   
          const jsonStringFromMessage = message[0] === "{" ? message : message.slice(messageSplitIndexAt).trim()

          const log = JSON.parse(jsonStringFromMessage)

          if (store.set.has(log.id) || store.set.has(jsonStringFromMessage)) {
            return null // Dont include duplicates
          } else {
            store.set.add(log.id || jsonStringFromMessage)
          }

          if (log.meta?.username && !createUsernameColors[log.meta.username]) {
            createUsernameColors[log.meta.username] = stringToHex(log.meta.username)
          }

          return {
            showMeta: false,
            id: uuidv4(),
            friendlyTime: `${formatTwoDigits(dateFromTimestamp.getHours())}:${formatTwoDigits(dateFromTimestamp.getMinutes())}:${formatTwoDigits(dateFromTimestamp.getSeconds())}`,
            ...log,
          }
        }).filter(x => x)
        if (!['app-driver', 'app-consumer'].includes(createLogs[0]?.meta?.service)) return

        // Override css
        getTable().insertAdjacentHTML('beforebegin', `<style>${overrideCss}</style>`)

        setLogs(prevLogs => {

          const newLogsLastTime = new Date(createLogs[createLogs.length - 1].timestamp)
          const previousLogsFirstTime = new Date(prevLogs?.[0].timestamp || 0)

          if (newLogsLastTime <= previousLogsFirstTime) {
            return [
              ...createLogs,
              ...(prevLogs ?? [])
            ]
          } else {
            return [
              ...(prevLogs ?? []),
              ...createLogs
            ]
          }
          
        }
          )
        setUsernameColors(createUsernameColors)
    }
  }, [])



  useMutationObservable(getRowContainer(), scrapeLogs);

  useEffect(() => {
    const init = async () => {
      setHasInited(true)

      scrapeLogs()
    }


    !hasInited && init()
  }, [scrapeLogs, hasInited])


  const levelIcon = (level: Loglevels) => {
    switch (level) {
      case 'info':
        return <InfoIcon />
      case 'warn':
        return <WarnIcon />
      case 'error':
        return <ErrorIcon />
      default:
        return null
    }
  }

  const handleToggleMeta = (id: string) => {
    const updatedLogs = [...logs].map(log => {

      if (log.id === id) return {...log, showMeta: !log.showMeta}

      return log
    })

    setLogs(updatedLogs)
  }

  return (
      <ul className="w-full text-2xl text-gray-700 font-mono">
        {
          logs && logs.map(({msg, friendlyTime, level, data, meta, timestamp, id, showMeta}) => {
            return (
              <li key={id} className="log-item">
                <div className="min-h-12 w-full flex flex-col p-1" style={{ backgroundColor: msg?.includes('[WARNING]') ? '#f5c1c1' : ''}}>
                  <div className="cursor-pointer" onClick={() => handleToggleMeta(id)}>
                    <div className="h-10 flex items-center w-full">
                      <div className={`mr-1 w-[20px] min-w-[20px] level-${level}`}>{levelIcon(level)}</div>
                      <div className="mr-2 text-lg font-thin min-w-[60px] w-[60px]">{friendlyTime}</div>
                      <div className={`mr-5 min-w-[150px] text-lg text-center rounded border py-1 px-2 overflow-hidden text-ellipsis ${showMeta ? 'break-words' : 'whitespace-nowrap w-[150px]' }`} style={{ backgroundColor: meta.username ? usernameColors[meta.username] + '40' : 'rgb(222,222,222)', borderColor: meta.username ? usernameColors[meta.username] + '80' : '' }}>{meta.username || ''}</div>
                      <div className={`text-xl font-medium text-gray-800 overflow-hidden text-ellipsis ${showMeta ? 'break-words' : 'whitespace-nowrap' }`}>{msg}</div>
                      <div className="ml-auto caret-icon">
                        {showMeta ? <CaretDown /> : <CaretLeft />}
                      </div>
                    </div>
                    <div style={{ display: data && Object.keys(data).length > 0 ? 'block' : 'none' }} className="text-xl p-2 font-medium">
                      <JSONPretty id="json-pretty" mainStyle="color: #1f2937" stringStyle="color: #1287c8" keyStyle="color: #1f2937" booleanStyle="color: #c812c0" valueStyle="color: #005aff;" data={data}></JSONPretty>
                    </div>
                  </div>
                </div>
                <div style={{ display: showMeta ? 'block' : 'none' }} className="text-xl p-4 font-medium relative">
                  <div className="absolute top-2 right-2">metadata</div>
                  <JSONPretty id="json-pretty" mainStyle="color: #1f2937" stringStyle="color: #0d7d70" keyStyle="color: #1f2937" booleanStyle="color: #c812c0" valueStyle="color: #005aff;" data={{...meta, timestamp, level}}></JSONPretty>
                </div>
              </li>
            )
          })
        }
      </ul>
    )
}

const MUTATION_OBSERVABLE_OPTIONS = {
  config: { attributes: false, childList: true, subtree: false },
  debounceTime: 0
};

function useMutationObservable(targetEl, cb, options = MUTATION_OBSERVABLE_OPTIONS) {
  const [observer, setObserver] = useState(null);

  const { debounceTime } = options;
  const debouncedCallback = _.debounce(cb, debounceTime)

  useEffect(() => {
    if (!cb || typeof cb !== "function") {
      console.warn(
        `You must provide a valida callback function, instead you've provided ${cb}`
      );
      return;
    }
    
    const obs = new MutationObserver(
      debounceTime > 0 ? debouncedCallback : cb
    );
    setObserver(obs);
  }, [cb, setObserver]);

  useEffect(() => {
    if (!observer) return;

    if (!targetEl) {
      console.warn(
        `You must provide a valid DOM element to observe, instead you've provided ${targetEl}`
      );
    }

    const { config } = options;

    try {
      observer.observe(targetEl, config);
    } catch (e) {
      // console.warn(e);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [observer, targetEl, options]);
}