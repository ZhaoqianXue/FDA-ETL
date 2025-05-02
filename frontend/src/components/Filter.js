import React, { useState, useEffect, forwardRef } from 'react';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './Filter.css';

// 只读且禁止输入/粘贴/拖拽的日期输入组件
const StrictReadOnlyInput = forwardRef((props, ref) => (
  <input
    {...props}
    ref={ref}
    readOnly
    className="date-picker"
    onKeyDown={e => e.preventDefault()}
    onPaste={e => e.preventDefault()}
    onDrop={e => e.preventDefault()}
  />
));

const Filter = ({ medications, adverseEvents, onFilterChange, onExportCSV, topPercent, setTopPercent, totalAdverseEvents }) => {
  const [medication, setMedication] = useState(null);
  const [adverseEvent, setAdverseEvent] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Calculate number of effects for current percentage
  const effectCount = Math.max(1, Math.round(totalAdverseEvents * topPercent / 100));

  // Apply filters when any of the filter values or topPercent change
  useEffect(() => {
    const formattedFilters = {
      medication: medication?.value || '',
      adverse_event: adverseEvent?.value || '',
      start_date: startDate ? formatDate(startDate) : '',
      end_date: endDate ? formatDate(endDate) : ''
    };
    onFilterChange(formattedFilters, topPercent);
  }, [medication, adverseEvent, startDate, endDate, topPercent]);

  // Format date as YYYY-MM-DD for API
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const resetFilters = () => {
    setMedication(null);
    setAdverseEvent(null);
    setStartDate(null);
    setEndDate(null);
    setTopPercent(5); // Reset slider to 5%
    // 立即通知父组件清空所有filter
    onFilterChange({
      medication: '',
      adverse_event: '',
      start_date: '',
      end_date: ''
    }, 5);
  };

  // Custom styles for react-select
  const selectStyles = {
    control: (styles) => ({
      ...styles,
      borderRadius: '4px',
      borderColor: '#ced4da',
      boxShadow: 'none',
      '&:hover': {
        borderColor: '#80bdff'
      }
    }),
    menu: (styles) => ({
      ...styles,
      zIndex: 999
    })
  };

  return (
    <div className="filter-container">
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="medication">Medication</label>
          <Select
            id="medication"
            value={medication}
            onChange={setMedication}
            options={medications}
            placeholder="Select medication..."
            isClearable
            styles={selectStyles}
            className="filter-select"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="adverse-event">Adverse Event</label>
          <Select
            id="adverse-event"
            value={adverseEvent}
            onChange={setAdverseEvent}
            options={adverseEvents}
            placeholder="Select adverse event..."
            isClearable
            isSearchable
            styles={selectStyles}
            className="filter-select"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="start-date">Start Date</label>
          <DatePicker
            id="start-date"
            selected={startDate}
            onChange={date => setStartDate(date)}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            maxDate={new Date()}
            placeholderText="Start date"
            className="date-picker"
            dateFormat="yyyy-MM-dd"
            isClearable
            shouldCloseOnSelect
            showMonthDropdown
            showYearDropdown
            customInput={<StrictReadOnlyInput />}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="end-date">End Date</label>
          <DatePicker
            id="end-date"
            selected={endDate}
            onChange={date => setEndDate(date)}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            minDate={startDate}
            maxDate={new Date()}
            placeholderText="End date"
            className="date-picker"
            dateFormat="yyyy-MM-dd"
            isClearable
            shouldCloseOnSelect
            showMonthDropdown
            showYearDropdown
            customInput={<StrictReadOnlyInput />}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="top-adverse-events">Top Adverse Events</label>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 220 }}>
            <input
              id="top-adverse-events"
              type="range"
              min={1}
              max={100}
              step={1}
              value={topPercent}
              onChange={e => setTopPercent(Number(e.target.value))}
              style={{ flex: 1, marginRight: 8 }}
            />
            <span style={{ minWidth: 70, textAlign: 'right', fontSize: '0.95em' }}>{topPercent}% ({effectCount} effects)</span>
          </div>
          <div style={{ fontSize: '0.85em', color: '#888', marginTop: 2 }}>Percentage to Display</div>
        </div>

        <div className="filter-actions-vertical">
          <button className="btn btn-reset" onClick={resetFilters}>
            Reset Filters
          </button>
          <button className="btn btn-export" onClick={onExportCSV}>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default Filter; 