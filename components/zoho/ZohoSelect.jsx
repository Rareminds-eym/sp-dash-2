'use client';

import { useCallback, useId, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './ZohoSelect.module.css';

// Radix reserves the empty string for placeholders. Keep existing empty filter
// and mapping values at the component boundary, including a selectable reset.
const EMPTY = '__zoho_empty_option__';

export default function ZohoSelect({ value, onValueChange, options, disabled = false, id, className = '', 'aria-label': label }) {
  const generatedId = useId();
  const [container, setContainer] = useState(null);
  const attach = useCallback(node => {
    // Native modal dialogs live above body portals. Keep their menus in the
    // same top layer so options remain visible, clickable and focusable.
    if (node) setContainer(node.closest('dialog'));
  }, []);
  const selected = options.find(option => option.value === value);

  return <Select.Root value={value === '' ? EMPTY : value} disabled={disabled}
    onValueChange={next => onValueChange(next === EMPTY ? '' : next)}>
    <Select.Trigger ref={attach} id={id || generatedId} type="button" aria-label={label}
      title={selected?.label} className={`${styles.fieldTrigger} ${className}`}>
      <Select.Value className={styles.fieldValue}/>
      <Select.Icon className={styles.chevron}><ChevronDown size={16}/></Select.Icon>
    </Select.Trigger>
    <Select.Portal container={container}>
      <Select.Content className={styles.menu} position="popper" sideOffset={6} align="start" collisionPadding={12}>
        <Select.ScrollUpButton className={styles.scrollButton}><ChevronUp size={16}/></Select.ScrollUpButton>
        <Select.Viewport className={styles.viewport}>
          {options.map(option => <Select.Item key={option.value} value={option.value === '' ? EMPTY : option.value}
            textValue={option.label} disabled={option.disabled} className={styles.compactItem}>
            <Select.ItemText>{option.label}</Select.ItemText>
            <Select.ItemIndicator className={styles.selectedMark}><Check size={15}/></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
        <Select.ScrollDownButton className={styles.scrollButton}><ChevronDown size={16}/></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}
