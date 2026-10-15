'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. check if table exists
    const [results] = await queryInterface.sequelize.query("SHOW TABLES LIKE 'ru_call_logs'");
    
    if (results.length > 0) {
      // Table exists, modify it
      const transaction = await queryInterface.sequelize.transaction();
      try {
        // Drop unnecessary columns (just to be safe we list what we want to keep, and drop everything else)
        // Known columns: id, call_status, remarks, user_type, user_id, lead_id, createdBy, createdAt, updatedAt
        const [columns] = await queryInterface.sequelize.query("SHOW COLUMNS FROM ru_call_logs", { transaction });
        const existingColumns = columns.map(c => c.Field);
        
        // rename user_type to entity
        if (existingColumns.includes('user_type')) {
          await queryInterface.renameColumn('ru_call_logs', 'user_type', 'entity', { transaction });
        }
        
        // user_id -> entity_id
        if (existingColumns.includes('user_id')) {
          await queryInterface.renameColumn('ru_call_logs', 'user_id', 'entity_id', { transaction });
        }
        
        // lead_id -> entity_type_id
        if (existingColumns.includes('lead_id')) {
          await queryInterface.renameColumn('ru_call_logs', 'lead_id', 'entity_type_id', { transaction });
        }
        
        // createdBy -> created_by
        if (existingColumns.includes('createdBy')) {
          await queryInterface.renameColumn('ru_call_logs', 'createdBy', 'created_by', { transaction });
        }

        // createdAt -> created_at
        if (existingColumns.includes('createdAt')) {
          await queryInterface.renameColumn('ru_call_logs', 'createdAt', 'created_at', { transaction });
        }
        
        // updatedAt -> updated_at
        if (existingColumns.includes('updatedAt')) {
          await queryInterface.renameColumn('ru_call_logs', 'updatedAt', 'updated_at', { transaction });
        }
        
        // Add new columns
        const [updatedColumns] = await queryInterface.sequelize.query("SHOW COLUMNS FROM ru_call_logs", { transaction });
        const newCols = updatedColumns.map(c => c.Field);

        if (!newCols.includes('entity_type')) {
          await queryInterface.addColumn('ru_call_logs', 'entity_type', {
            type: Sequelize.STRING,
            allowNull: true
          }, { transaction, after: 'entity' });
          // Set existing records based on user instructions
          await queryInterface.sequelize.query("UPDATE ru_call_logs SET entity_type = 'leads', entity = 'dsa'", { transaction });
        }
        
        if (!newCols.includes('is_staled')) {
          await queryInterface.addColumn('ru_call_logs', 'is_staled', {
            type: Sequelize.BOOLEAN,
            defaultValue: false
          }, { transaction, after: 'updated_at' });
        }
        


        // Drop any other columns not in required list: id, call_status, remarks, entity, entity_type, entity_id, entity_type_id, created_by, created_at, updated_at, is_staled
        const allowedCols = ['id', 'call_status', 'remarks', 'entity', 'entity_type', 'entity_id', 'entity_type_id', 'created_by', 'created_at', 'updated_at', 'is_staled'];
        const [finalColumns] = await queryInterface.sequelize.query("SHOW COLUMNS FROM ru_call_logs", { transaction });
        const finalColsToDrop = finalColumns.map(c => c.Field).filter(c => !allowedCols.includes(c));
        
        for (const col of finalColsToDrop) {
           await queryInterface.removeColumn('ru_call_logs', col, { transaction });
        }

        // Add composite index (entity, entity_type, entity_id)
        const [indexResults] = await queryInterface.sequelize.query("SHOW INDEX FROM ru_call_logs WHERE Key_name = 'idx_entity_type_id'", { transaction });
        if (indexResults.length === 0) {
          await queryInterface.addIndex('ru_call_logs', ['entity', 'entity_type', 'entity_id'], {
            name: 'idx_entity_type_id',
            transaction
          });
        }

        await transaction.commit();
      } catch (e) {
        await transaction.rollback();
        throw e;
      }
    } else {
      // Table doesn't exist, create it
      await queryInterface.createTable('ru_call_logs', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        call_status: {
          type: Sequelize.STRING,
          allowNull: true
        },
        remarks: {
          type: Sequelize.STRING,
          allowNull: true
        },
        entity: {
          type: Sequelize.STRING,
          allowNull: true
        },
        entity_type: {
          type: Sequelize.STRING,
          allowNull: true
        },
        entity_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        entity_type_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_by: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        is_staled: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      });


      // add index
      await queryInterface.addIndex('ru_call_logs', ['entity', 'entity_type', 'entity_id'], {
        name: 'idx_entity_type_id'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ru_call_logs');
  }
};
