import React from "react";
import { observer } from "mobx-react-lite";
import { beanTabStore } from "../stores/beanTabStore";

interface ModifiedCellProps {
  value: number;
  account: string;
  currency: string;
  date: string;
  createElement: any;
}

const ModifiedCell: React.FC<ModifiedCellProps> = ({
  value,
  account,
  currency,
  date,
  createElement,
}) => {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(value));
  
  const spanElement = createElement('span', {
    style: {
      color: value >= 0 ? '#2e7d32' : '#d32f2f',
      fontWeight: 'bold',
    }
  }, value >= 0 ? formatted : `(${formatted})`);

  // This component is only called for modified cells, so we can skip the check

  const revertButton = createElement('button', {
    style: {
      position: 'absolute',
      top: '2px',
      right: '2px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '10px',
      color: '#666',
      padding: '0',
      width: '12px',
      height: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    onClick: (e: any) => {
      e.stopPropagation();
      beanTabStore.revertCell(account, currency, date);
    },
    title: 'Revert this cell'
  }, '↶');

  return createElement('div', {
    style: {
      border: '3px dotted rgb(46, 125, 50)',
      height: '100%',
      width: '100%',
      paddingLeft: '5px',
      paddingRight: '15px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    }
  }, [spanElement, revertButton]);
};

export default observer(ModifiedCell);
