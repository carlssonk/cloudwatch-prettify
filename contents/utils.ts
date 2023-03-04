const selector = {
  iframe: '#microConsole-Logs',
  rowContainer: 'div.awsui-table-container > table > tbody',
  rows: '.awsui-table-row',
  timestamp: '.logs__log-events-table__timestamp-cell',
  json: '[data-testid=logs__log-events-table__message]',
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

export { selector, getRowContainer, formatTwoDigits, stringToHex }