import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { closeTabs } from 'providers/ReduxStore/slices/tabs';

const useChangelogOnUpdate = () => {
  const dispatch = useDispatch();
  const tabs = useSelector((state) => state.tabs?.tabs);

  useEffect(() => {
    // If any What's New / changelog tabs are open, close them
    if (Array.isArray(tabs)) {
      const changelogTabs = tabs.filter((t) => t.type === 'changelog');
      if (changelogTabs.length > 0) {
        dispatch(closeTabs({ tabUids: changelogTabs.map((t) => t.uid) }));
      }
    }
  }, [tabs, dispatch]);
};

export default useChangelogOnUpdate;
