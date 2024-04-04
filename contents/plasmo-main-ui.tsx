import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useState, memo } from "react"
import overrideCss from "data-text:../override.css"
import mainCss from "data-text:../main.css"
import { formatTwoDigits, getRowContainer, getTable, selector, stringToHex, waitForAnchor, getSearchStr } from "./utils"
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

function getLogId(node: any) {
  const timestamp = node.querySelector(selector.json)?.innerText?.trim() as string
  return JSON.stringify(timestamp)
}

function PlasmoMainUI() {
  const [logs, setLogs] = useState<Log[] | null>([])
  const [hasInited, setHasInited] = useState(false)
  const [store] = useState({
    prevLength: 0,
    previousBatchFirstLogId: '',
    prevSearch: '',
  })
  const [usernameColors, setUsernameColors] = useState({})

  const scrapeLogs = useCallback(() => {

      const rowContainer = getRowContainer()

      if (rowContainer) {
        // Check if search has changes since previous fetch
        const currentSearch = getSearchStr()
        const searchHasChanged = store.prevSearch !== currentSearch
        if (searchHasChanged) {
          store.prevLength = 0
          setLogs([])
        }

        const childNodesArray = [...rowContainer.childNodes]

        // 2 = skip the Load more/Resume row and skip this ui compoonent
        // childNodesArray.length - 1 = skip the Load more/Resume row
        const slicedChildNodesArray = childNodesArray.slice(2, childNodesArray.length - 1)
        if (slicedChildNodesArray.length === 0) return
        

        const newBatchFirstLogId = getLogId(slicedChildNodesArray[0])
        let left = 0;
        let right = slicedChildNodesArray.length;
        if (store.prevLength) {
          if (newBatchFirstLogId !== store.previousBatchFirstLogId) {
            left = 0;
            right = slicedChildNodesArray.length - store.prevLength
          } else {
            left =  store.prevLength
            right = slicedChildNodesArray.length
          }
        }

        const createUsernameColors = {}

        const newLogs = []

        while (left < right) {
          const row = slicedChildNodesArray[left] as any

          const timestamp = row.querySelector(selector.timestamp)?.innerText?.trim() as string
          if (!timestamp) return null
          const dateFromTimestamp = new Date(timestamp)

          const message = row.querySelector(selector.json)?.innerText?.trim() as string
          if (!message) return null
          
          const messageSplitIndexAt = message?.indexOf('-') + 1
   
          const jsonStringFromMessage = message[0] === "{" ? message : message.slice(messageSplitIndexAt).trim()

          const log = JSON.parse(jsonStringFromMessage)

          if (log.meta?.username && !createUsernameColors[log.meta.username]) {
            createUsernameColors[log.meta.username] = stringToHex(log.meta.username)
          }

          newLogs.push({
            showMeta: false,
            id: uuidv4(),
            friendlyTime: `${formatTwoDigits(dateFromTimestamp.getHours())}:${formatTwoDigits(dateFromTimestamp.getMinutes())}:${formatTwoDigits(dateFromTimestamp.getSeconds())}`,
            ...log,
          })

          left++
        }

        if (!['app-driver', 'app-consumer'].includes(newLogs[0]?.meta?.service)) return

        // Override css
        getTable().insertAdjacentHTML('beforebegin', `<style>${overrideCss}</style>`)

        const previousBatchFirstLogId = store.previousBatchFirstLogId
        if (searchHasChanged) {
          setLogs(newLogs)
        } else {
          // If search has not changed, it means that this batch of logs comes from scrolling the list, so append/prepend logs instead of clearing previous logs.
          setLogs(prevLogs => {
            if (newBatchFirstLogId !== previousBatchFirstLogId) {
              return [
                ...newLogs,
                ...(prevLogs ?? [])
              ]
            } else {
              return [
                ...(prevLogs ?? []),
                ...newLogs
              ]
            }
          })
        }

        setUsernameColors(createUsernameColors)

        store.previousBatchFirstLogId = newBatchFirstLogId
        store.prevLength = slicedChildNodesArray.length
        store.prevSearch = currentSearch
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

  const filteredLogs = logs.filter(x => x)

  return (
      <ul className="w-full text-2xl text-gray-700 font-mono">

          {
          filteredLogs.length > 0 && filteredLogs.map(item => {
            return <ListItem key={item.id} item={item} usernameColors={usernameColors} levelIcon={levelIcon} handleToggleMeta={handleToggleMeta} />
          })
        }
      </ul>
    )
}

const ListItem = memo(({ item, usernameColors, levelIcon, handleToggleMeta }: {item: Log, usernameColors: any, levelIcon: any, handleToggleMeta: any}) => {
  const {msg, friendlyTime, level, data, meta, timestamp, id, showMeta} = item
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
});

ListItem.displayName = 'ListItem';


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