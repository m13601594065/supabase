import React, { FC, useState } from 'react'
import { partition, isEmpty, isUndefined } from 'lodash'
import {
  Alert,
  Button,
  IconEdit,
  IconHelpCircle,
  IconKey,
  IconTrash,
  Typography,
} from '@supabase/ui'
import {
  PostgresTable,
  PostgresColumn,
  PostgresRelationship,
  PostgresType,
} from '@supabase/postgres-meta'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DroppableProvided,
  DraggableProvided,
} from 'react-beautiful-dnd'
import * as Tooltip from '@radix-ui/react-tooltip'

import Column from './Column'
import InformationBox from 'components/ui/InformationBox'
import ForeignKeySelector from '../ForeignKeySelector/ForeignKeySelector'
import { ColumnField } from '../SidePanelEditor.types'
import { ImportContent } from './TableEditor.types'
import { generateColumnField } from '../ColumnEditor/ColumnEditor.utils'

interface Props {
  table?: Partial<PostgresTable>
  tables: PostgresTable[]
  columns?: ColumnField[]
  enumTypes: PostgresType[]
  importContent?: ImportContent
  isNewRecord: boolean
  onColumnsUpdated: (columns: ColumnField[]) => void
  onSelectImportData: () => void
  onClearImportContent: () => void
}

const ColumnManagement: FC<Props> = ({
  table,
  tables = [],
  columns = [],
  enumTypes = [],
  importContent = {},
  isNewRecord,
  onColumnsUpdated = () => {},
  onSelectImportData = () => {},
  onClearImportContent = () => {},
}) => {
  const [selectedColumnToEditRelation, setSelectedColumnToEditRelation] = useState<ColumnField>()

  const hasImportContent = !isEmpty(importContent)
  const [primaryKeyColumns, otherColumns] = partition(
    columns,
    (column: ColumnField) => column.isPrimaryKey
  )

  const saveColumnForeignKey = (
    foreignKeyConfiguration: { table: PostgresTable; column: PostgresColumn } | undefined
  ) => {
    if (!isUndefined(selectedColumnToEditRelation)) {
      onUpdateColumn(selectedColumnToEditRelation, {
        foreignKey: !isUndefined(foreignKeyConfiguration)
          ? {
              id: 0,
              constraint_name: '',
              source_schema: table?.schema ?? '',
              source_table_name: table?.name ?? '',
              source_column_name: selectedColumnToEditRelation?.name,
              target_table_schema: foreignKeyConfiguration.table.schema,
              target_table_name: foreignKeyConfiguration.table.name,
              target_column_name: foreignKeyConfiguration.column.name,
            }
          : undefined,
        ...(!isUndefined(foreignKeyConfiguration) && {
          format: foreignKeyConfiguration.column.format,
          defaultValue: null,
        }),
      })
    }
    setSelectedColumnToEditRelation(undefined)
  }

  const onUpdateColumn = (columnToUpdate: ColumnField, changes: Partial<ColumnField>) => {
    const updatedColumns = columns.map((column: ColumnField) => {
      if (column.id === columnToUpdate.id) {
        if ('name' in changes && !isUndefined(column.foreignKey)) {
          const foreignKey: PostgresRelationship = {
            ...column.foreignKey,
            source_column_name: changes?.name ?? '',
          }
          return { ...column, ...changes, foreignKey }
        }
        return { ...column, ...changes }
      } else {
        return column
      }
    })
    onColumnsUpdated(updatedColumns)
  }

  const onAddColumn = () => {
    const defaultColumn = generateColumnField()
    const updatedColumns = columns.concat(defaultColumn)
    onColumnsUpdated(updatedColumns)
  }

  const onRemoveColumn = (columnToRemove: ColumnField) => {
    const updatedColumns = columns.filter((column: ColumnField) => column.id !== columnToRemove.id)
    onColumnsUpdated(updatedColumns)
  }

  const onSortColumns = (result: any, type: 'pks' | 'others') => {
    // Dropped outside of the list
    if (!result.destination) {
      return
    }

    if (type === 'pks') {
      const updatedPrimaryKeyColumns = primaryKeyColumns.slice()
      const [removed] = updatedPrimaryKeyColumns.splice(result.source.index, 1)
      updatedPrimaryKeyColumns.splice(result.destination.index, 0, removed)
      const updatedColumns = updatedPrimaryKeyColumns.concat(otherColumns)
      return onColumnsUpdated(updatedColumns)
    }

    if (type === 'others') {
      const updatedOtherColumns = otherColumns.slice()
      const [removed] = updatedOtherColumns.splice(result.source.index, 1)
      updatedOtherColumns.splice(result.destination.index, 0, removed)
      const updatedColumns = primaryKeyColumns.concat(updatedOtherColumns)
      return onColumnsUpdated(updatedColumns)
    }
  }

  return (
    <>
      <div className="table-editor-columns w-full space-y-4">
        <div className="flex w-full items-center justify-between">
          <Typography.Title level={5}>Columns</Typography.Title>
          {isNewRecord && (
            <>
              {hasImportContent ? (
                <div className="flex items-center space-x-3">
                  <Button type="default" icon={<IconEdit />} onClick={onSelectImportData}>
                    Edit content
                  </Button>
                  <Button danger type="outline" icon={<IconTrash />} onClick={onClearImportContent}>
                    Remove content
                  </Button>
                </div>
              ) : (
                <Button type="default" onClick={onSelectImportData}>
                  Import data via spreadsheet
                </Button>
              )}
            </>
          )}
        </div>

        {hasImportContent && (
          <div className="my-2 opacity-75">
            <Typography.Text>
              Your table will be created with {importContent?.rowCount?.toLocaleString()} rows and
              the following {columns.length} columns.
            </Typography.Text>
          </div>
        )}

        {primaryKeyColumns.length === 0 && (
          <Alert title="Warning: No primary keys selected" variant="warning" withIcon>
            Tables require at least one column as a primary key in order to uniquely identify each
            row. Without a primary key, you will not be able to update or delete rows from the
            table.
          </Alert>
        )}

        {primaryKeyColumns.length > 1 && (
          <InformationBox
            block
            icon={<IconKey className="text-white" size="large" />}
            title="Composite primary key selected"
            description="The columns that you've selected will grouped as a primary key, and will serve
            as the unique identifier for the rows in your table"
          />
        )}

        <div className="space-y-2">
          {/* Headers */}
          <div className="flex w-full px-3">
            {/* Drag handle */}
            {isNewRecord && <div className="w-[5%]" />}
            <div className="w-[25%]">
              <h5 className="text-scale-900 text-xs">Name</h5>
            </div>
            <div className="w-[25%]">
              <h5 className="text-scale-900 text-xs">Type</h5>
            </div>
            <div className={`${isNewRecord ? 'w-[25%]' : 'w-[30%]'} flex items-center space-x-2`}>
              <h5 className="text-scale-900 text-xs">Default Value</h5>

              <Tooltip.Root delayDuration={0}>
                <Tooltip.Trigger>
                  <h5 className="text-scale-900 text-xs">
                    <IconHelpCircle size={15} strokeWidth={1.5} />
                  </h5>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom">
                  <Tooltip.Arrow className="radix-tooltip-arrow" />
                  <div
                    className={[
                      'bg-scale-100 rounded py-1 px-2 leading-none shadow', // background
                      'border-scale-200 border ', //border
                    ].join(' ')}
                  >
                    <span className="text-scale-1200 text-xs">
                      Can be either a value or a SQL expression
                    </span>
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>
            </div>
            <div className="w-[10%]">
              <h5 className="text-scale-900 text-xs">Primary</h5>
            </div>
            {/* Empty space */}
            <div className={`${hasImportContent ? 'w-[10%]' : 'w-0'}`} />
            {/* More config button */}
            <div className="w-[5%]" />
            {/* Delete button */}
            {!hasImportContent && <div className="w-[5%]" />}
          </div>

          {primaryKeyColumns.length > 0 && (
            <DragDropContext onDragEnd={(result: any) => onSortColumns(result, 'pks')}>
              <Droppable droppableId="pk_columns_droppable">
                {(droppableProvided: DroppableProvided) => (
                  <div
                    ref={droppableProvided.innerRef}
                    className={`space-y-2 rounded-md bg-gray-400 px-3 py-2 ${
                      isNewRecord ? '' : '-mx-3'
                    }`}
                  >
                    {primaryKeyColumns.map((column: ColumnField, index: number) => (
                      <Draggable key={column.id} draggableId={column.id} index={index}>
                        {(draggableProvided: DraggableProvided) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                          >
                            <Column
                              column={column}
                              enumTypes={enumTypes}
                              isNewRecord={isNewRecord}
                              hasImportContent={hasImportContent}
                              dragHandleProps={draggableProvided.dragHandleProps}
                              onEditRelation={() => {
                                setSelectedColumnToEditRelation(column)
                              }}
                              onUpdateColumn={(changes) => onUpdateColumn(column, changes)}
                              onRemoveColumn={() => onRemoveColumn(column)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {droppableProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          <DragDropContext onDragEnd={(result: any) => onSortColumns(result, 'others')}>
            <Droppable droppableId="other_columns_droppable">
              {(droppableProvided: DroppableProvided) => (
                <div
                  ref={droppableProvided.innerRef}
                  className={`space-y-2 py-2 ${isNewRecord ? 'px-3 ' : ''}`}
                >
                  {otherColumns.map((column: ColumnField, index: number) => (
                    <Draggable key={column.id} draggableId={column.id} index={index}>
                      {(draggableProvided: DraggableProvided) => (
                        <div ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                          <Column
                            column={column}
                            enumTypes={enumTypes}
                            isNewRecord={isNewRecord}
                            hasImportContent={hasImportContent}
                            dragHandleProps={draggableProvided.dragHandleProps}
                            onEditRelation={() => {
                              setSelectedColumnToEditRelation(column)
                            }}
                            onUpdateColumn={(changes) => onUpdateColumn(column, changes)}
                            onRemoveColumn={() => onRemoveColumn(column)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {droppableProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {!hasImportContent && (
          <Button type="default" onClick={() => onAddColumn()}>
            Add column
          </Button>
        )}
      </div>
      <ForeignKeySelector
        tables={tables}
        column={selectedColumnToEditRelation as ColumnField}
        visible={!isUndefined(selectedColumnToEditRelation)}
        closePanel={() => setSelectedColumnToEditRelation(undefined)}
        saveChanges={saveColumnForeignKey}
      />
    </>
  )
}

export default ColumnManagement
