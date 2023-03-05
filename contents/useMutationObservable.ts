import _ from "lodash";
import { useEffect, useState } from "react";

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
  }, [cb, debounceTime, debouncedCallback, options, setObserver]);

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

export { useMutationObservable }