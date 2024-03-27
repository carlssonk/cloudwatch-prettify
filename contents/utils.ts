import type { PlasmoCSUIAnchor } from "plasmo"

const selector = {
  iframe: '#microConsole-Logs',
  table: 'table',
  rowContainer: 'tbody',
  rows: '.awsui-table-row',
  timestamp: '.logs__log-events-table__timestamp-cell',
  json: '[data-testid=logs__log-events-table__message]',
}

const getTable = () => {
  const foundIframe = document.querySelector<HTMLIFrameElement>(selector.iframe)
  if (!foundIframe) return null
  return foundIframe.contentWindow.document.body.querySelector(selector.table)
}

const getRowContainer = () => {
  const foundIframe = document.querySelector<HTMLIFrameElement>(selector.iframe)
  if (!foundIframe) return null
  return foundIframe.contentWindow.document.body.querySelector(selector.rowContainer)
}

const formatTwoDigits = (n: number) => {
  return ('0' + n).slice(-2)
 }

const stringToHex = (str: string) => {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 255;
      color += ('00' + value.toString(16)).slice(-2);
  }

  return color;
}

const waitForAnchor = (): Promise<PlasmoCSUIAnchor> =>
  new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const rootContainer = getRowContainer()?.querySelector('.awsui_row_wih1l_1efw1_314')
      if (rootContainer) {
        clearInterval(checkInterval)
        resolve({element: rootContainer, type: 'inline'})
      }
    }, 100)
  })

export { selector, getRowContainer, formatTwoDigits, stringToHex, waitForAnchor, getTable }