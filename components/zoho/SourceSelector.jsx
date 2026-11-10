'use client';

import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp, Database } from 'lucide-react';
import styles from './ZohoSelect.module.css';

const regions = { us: 'United States', in: 'India', eu: 'Europe', jp: 'Japan', cn: 'China' };

export default function SourceSelector({ connections, value, onValueChange }) {
  const selected = connections.find(source => source.id === value);

  return <Select.Root value={value} onValueChange={onValueChange} disabled={!connections.length}>
    <Select.Trigger id="zoho-source-selector" className={styles.trigger} title={selected?.name}>
      <span className={styles.sourceIcon} aria-hidden="true"><Database size={16}/></span>
      <Select.Value placeholder={connections.length ? 'Choose a source' : 'No source registered'}>
        <span className={styles.triggerText}>{selected?.name}</span>
      </Select.Value>
      {selected?.region && <span className={styles.region}>{selected.region.toUpperCase()}</span>}
      <Select.Icon className={styles.chevron}><ChevronDown size={16}/></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className={styles.menu} position="popper" sideOffset={8} align="start" collisionPadding={12}>
        <Select.ScrollUpButton className={styles.scrollButton}><ChevronUp size={16}/></Select.ScrollUpButton>
        <Select.Viewport className={styles.viewport}>
          <Select.Group>
            <Select.Label className={styles.menuHeading}>Select a source <span>{connections.length} available</span></Select.Label>
            {connections.map(source => <Select.Item key={source.id} value={source.id} textValue={source.name} className={styles.item}>
              <span className={styles.itemIcon} aria-hidden="true"><Database size={17}/></span>
              <Select.ItemText className={styles.itemText}>
                <span className={styles.itemName}>{source.name}</span>
                <span className={styles.itemMeta}>{regions[source.region] || source.region?.toUpperCase() || 'Region unavailable'} data center{source.status ? ` · ${source.status.replaceAll('_', ' ')}` : ''}</span>
              </Select.ItemText>
              <Select.ItemIndicator className={styles.selectedMark}><Check size={15}/></Select.ItemIndicator>
            </Select.Item>)}
          </Select.Group>
        </Select.Viewport>
        <Select.ScrollDownButton className={styles.scrollButton}><ChevronDown size={16}/></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}
